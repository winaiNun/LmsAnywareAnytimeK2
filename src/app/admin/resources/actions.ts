"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { randomUUID } from "crypto";
import { ICON_OUT, MAX_ZOOM, clampCenter } from "@/lib/avatar";
import { audit } from "@/lib/audit";
import { driveViewUrl, parseDriveFileId } from "@/lib/drive";
import { fetchDriveImage } from "@/lib/drive-fetch";
import { processAvatar } from "@/lib/image";
import { rateLimited } from "@/lib/rate-limit";
import { getSiteInfo } from "@/lib/site";
import { getStorage } from "@/lib/storage";
import { db } from "@/lib/db";
import { safeHttpsUrl } from "@/lib/embed";
import { isIconKey } from "@/lib/icon-paths";
import { assertRole, isManager } from "@/lib/permissions";

export type ResourceFormState = { error?: string; saved?: boolean } | undefined;

const MAX_ICON_BYTES = 2 * 1024 * 1024;
const driveCropSchema = z.object({ cx: z.number().min(0).max(1), cy: z.number().min(0).max(1), zoom: z.number().min(1).max(MAX_ZOOM), aspect: z.number().min(0.2).max(5) });

const schema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อเว็บ/แหล่งสื่อ").max(80, "ชื่อยาวเกินไป (ไม่เกิน 80 ตัวอักษร)"),
  url: z.string().trim().min(1, "กรุณากรอกลิงก์"),
  description: z.string().trim().max(200, "คำอธิบายไม่เกิน 200 ตัวอักษร").optional().transform((v) => v || null),
  groupName: z.string().trim().max(40, "ชื่อกลุ่มไม่เกิน 40 ตัวอักษร").optional().transform((v) => v || "ทั่วไป"),
  icon: z.string().refine(isIconKey, "ไอคอนไม่ถูกต้อง"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "สีไม่ถูกต้อง"),
});

function refresh() {
  revalidatePath("/admin/resources");
  revalidatePath("/resources");
  revalidatePath("/");
  revalidateTag("footer");
}

/** Create (id empty) or update one outside source. Links must be https and pass the same safety checks as media links. */
export async function saveResource(id: string | null, _prev: ResourceFormState, f: FormData): Promise<ResourceFormState> {
  const actor = await assertRole(isManager);
  const parsed = schema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const link = safeHttpsUrl(parsed.data.url);
  if ("error" in link) return { error: link.error };
  const data: Record<string, unknown> = {
    name: parsed.data.name,
    url: link.url,
    description: parsed.data.description,
    groupName: parsed.data.groupName,
    icon: parsed.data.icon,
    color: parsed.data.color.toUpperCase(),
    active: f.get("active") === "on",
  };

  // The picture: keep what is there, or replace it with an upload / a Drive picture, or go back to the line icon.
  const existing = id ? await db.resourceLink.findUnique({ where: { id }, select: { id: true, iconKey: true } }) : null;
  if (id && !existing) return { error: "ไม่พบรายการ" };
  const mode = String(f.get("iconMode") ?? "keep");
  let newKey: string | null = null;
  if (mode === "upload") {
    if (!(await getSiteInfo()).allowServerUploads) return { error: "ขณะนี้ปิดการอัปโหลดรูปเข้าเซิร์ฟเวอร์ — ใช้ลิงก์ Google Drive แทน" };
    const file = f.get("iconFile");
    if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกรูปไอคอน" };
    if (file.size > MAX_ICON_BYTES) return { error: "ไฟล์ใหญ่เกินไป (ไม่เกิน 2 MB)" };
    let buf: Buffer;
    try {
      buf = await processAvatar(Buffer.from(await file.arrayBuffer()), ICON_OUT);
    } catch {
      return { error: "ไฟล์นี้ไม่ใช่รูปภาพที่อ่านได้" };
    }
    newKey = `media/resource-${randomUUID().slice(0, 12)}.webp`;
    await getStorage().put(newKey, buf, "image/webp");
    Object.assign(data, { iconKey: newKey, iconDriveId: null, iconCx: 0.5, iconCy: 0.5, iconZoom: 1, iconAspect: 1 });
  } else if (mode === "drive") {
    const crop = driveCropSchema.safeParse({ cx: Number(f.get("iconCx")), cy: Number(f.get("iconCy")), zoom: Number(f.get("iconZoom")), aspect: Number(f.get("iconAspect")) });
    const driveId = parseDriveFileId(String(f.get("iconLink") ?? ""));
    if (!crop.success || !driveId) return { error: "ข้อมูลรูปจาก Google Drive ไม่ถูกต้อง — ดึงภาพและครอบใหม่อีกครั้ง" };
    const { cx, cy } = clampCenter(crop.data.cx, crop.data.cy, crop.data.zoom, crop.data.aspect);
    Object.assign(data, { iconKey: null, iconDriveId: driveId, iconCx: cx, iconCy: cy, iconZoom: crop.data.zoom, iconAspect: crop.data.aspect });
  } else if (mode === "remove") {
    Object.assign(data, { iconKey: null, iconDriveId: null, iconCx: 0.5, iconCy: 0.5, iconZoom: 1, iconAspect: 1 });
  }
  const replaced = mode === "upload" || mode === "drive" || mode === "remove";

  if (id) {
    await db.resourceLink.update({ where: { id }, data });
    if (replaced && existing?.iconKey && existing.iconKey !== newKey) await getStorage().delete(existing.iconKey).catch(() => {});
    await audit({ actorId: actor.id, action: "resource.update", entity: "ResourceLink", entityId: id, meta: mode === "drive" ? { icon: driveViewUrl(String(parseDriveFileId(String(f.get("iconLink"))))) } : undefined });
  } else {
    const last = await db.resourceLink.aggregate({ _max: { sortOrder: true } });
    const row = await db.resourceLink.create({ data: { ...(data as Prisma.ResourceLinkUncheckedCreateInput), sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await audit({ actorId: actor.id, action: "resource.create", entity: "ResourceLink", entityId: row.id, meta: { url: row.url } });
  }
  refresh();
  return { saved: true };
}

export async function setResourceActive(id: string, active: boolean) {
  const actor = await assertRole(isManager);
  await db.resourceLink.updateMany({ where: { id }, data: { active } });
  await audit({ actorId: actor.id, action: active ? "resource.show" : "resource.hide", entity: "ResourceLink", entityId: id });
  refresh();
}

/** One step earlier / later in the list (the whole list is renumbered so the order is always clean). */
export async function moveResource(id: string, direction: "up" | "down") {
  await assertRole(isManager);
  const list = await db.resourceLink.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = list.findIndex((x) => x.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, order) => db.resourceLink.update({ where: { id: x.id }, data: { sortOrder: order } })));
  refresh();
}

export type DriveIconPreview = { ok: true; dataUrl: string; width: number; height: number } | { ok: false; error: string };

/** Step 1 for a Drive picture: fetch Drive's public thumbnail so the browser can show the crop dialog (the link itself is sent back with the form). */
export async function fetchResourceIconFromDrive(link: string): Promise<DriveIconPreview> {
  const actor = await assertRole(isManager);
  if (rateLimited(`res-icon-fetch:${actor.id}`, 20, 10 * 60 * 1000)) return { ok: false, error: "ดึงภาพบ่อยเกินไป กรุณารอสักครู่" };
  const img = await fetchDriveImage(link, 800);
  if (!img.ok) return img;
  return { ok: true, dataUrl: `data:${img.mime};base64,${img.buffer.toString("base64")}`, width: img.width, height: img.height };
}

export async function deleteResource(id: string): Promise<{ error?: string }> {
  const actor = await assertRole(isManager);
  const old = await db.resourceLink.findUnique({ where: { id }, select: { iconKey: true } });
  const r = await db.resourceLink.deleteMany({ where: { id } });
  if (old?.iconKey) await getStorage().delete(old.iconKey).catch(() => {});
  if (!r.count) return { error: "ไม่พบรายการ" };
  await audit({ actorId: actor.id, action: "resource.delete", entity: "ResourceLink", entityId: id });
  refresh();
  return {};
}
