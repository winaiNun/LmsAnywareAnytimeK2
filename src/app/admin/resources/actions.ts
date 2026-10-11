"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { safeHttpsUrl } from "@/lib/embed";
import { isIconKey } from "@/lib/icon-paths";
import { assertRole, isManager } from "@/lib/permissions";

export type ResourceFormState = { error?: string; saved?: boolean } | undefined;

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
  const data = {
    name: parsed.data.name,
    url: link.url,
    description: parsed.data.description,
    groupName: parsed.data.groupName,
    icon: parsed.data.icon,
    color: parsed.data.color.toUpperCase(),
    active: f.get("active") === "on",
  };
  if (id) {
    if (!(await db.resourceLink.findUnique({ where: { id }, select: { id: true } }))) return { error: "ไม่พบรายการ" };
    await db.resourceLink.update({ where: { id }, data });
    await audit({ actorId: actor.id, action: "resource.update", entity: "ResourceLink", entityId: id });
  } else {
    const last = await db.resourceLink.aggregate({ _max: { sortOrder: true } });
    const row = await db.resourceLink.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
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

export async function deleteResource(id: string): Promise<{ error?: string }> {
  const actor = await assertRole(isManager);
  const r = await db.resourceLink.deleteMany({ where: { id } });
  if (!r.count) return { error: "ไม่พบรายการ" };
  await audit({ actorId: actor.id, action: "resource.delete", entity: "ResourceLink", entityId: id });
  refresh();
  return {};
}
