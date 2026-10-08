"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { processCover } from "@/lib/image";
import { driveViewUrl, parseDriveFileId } from "@/lib/drive";
import { EFFECT_VALUES, isExternalUrl } from "@/lib/slideshow";
import { assertRole, canAuthor, isAdmin, isManager } from "@/lib/permissions";
import { getStorage } from "@/lib/storage";
import { parseInstant } from "@/lib/thai-date";

// Originals can be big: they are cropped to 3:1 and shrunk to WebP before saving.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || null);

// ISO instants from ThaiDateField (never a พ.ศ. number); zone-less legacy values count as Bangkok time.
const optionalDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseInstant(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "วันที่ไม่ถูกต้อง" });
      return z.NEVER;
    }
    return d;
  });

const schema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อ").max(120),
  subtitle: optionalText(300),
  buttonText: optionalText(40),
  // Only site-relative paths or http(s) URLs: blocks javascript:/data: links.
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^(\/(?!\/)\S*|https?:\/\/\S+)$/.test(v), "ลิงก์ไม่ถูกต้อง: ต้องขึ้นต้นด้วย / หรือ https:// และห้ามมีช่องว่าง"),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "สีไม่ถูกต้อง").default("#EAF0FF"),
  focusX: z.coerce.number().min(0).max(100).default(50),
  focusY: z.coerce.number().min(0).max(100).default(50),
  startAt: optionalDate,
  endAt: optionalDate,
});

export type BannerFormState = { error?: string } | undefined;

export async function saveBanner(id: string | null, _prev: BannerFormState, formData: FormData): Promise<BannerFormState> {
  const user = await assertRole(canAuthor);

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  if (data.startAt && data.endAt && data.endAt < data.startAt) {
    return { error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มแสดง" };
  }

  const existing = id ? await db.banner.findUnique({ where: { id } }) : null;
  if (id && !existing) return { error: "ไม่พบแบนเนอร์" };
  // Teachers may only touch their own slides.
  if (existing && !isManager(user.role) && existing.createdById !== user.id) return { error: "คุณแก้ไขได้เฉพาะสไลด์ที่คุณสร้างเอง" };

  let imageKey = existing?.imageKey ?? null;
  let sourceUrl = existing?.sourceUrl ?? null;
  const file = formData.get("image");
  const storage = getStorage();

  if (file instanceof File && file.size > 0) {
    if (!IMAGE_TYPES.includes(file.type)) return { error: "รองรับเฉพาะไฟล์ PNG, JPG, WebP" };
    if (file.size > MAX_IMAGE_BYTES) return { error: "ไฟล์รูปต้องไม่เกิน 10 MB" };
    let processed: Buffer;
    try {
      processed = await processCover(Buffer.from(await file.arrayBuffer()), { aspect: 3, maxWidth: 1800, fx: data.focusX / 100, fy: data.focusY / 100 });
    } catch {
      return { error: "ไฟล์รูปเสียหรืออ่านไม่ได้" };
    }
    const newKey = `banners/${randomUUID()}.webp`;
    await storage.put(newKey, processed, "image/webp");
    if (imageKey) await storage.delete(imageKey);
    imageKey = newKey;
    // remember where the picture came from (only a valid Drive link is accepted, rebuilt from its id)
    const driveId = parseDriveFileId(String(formData.get("sourceUrl") ?? ""));
    sourceUrl = driveId ? driveViewUrl(driveId) : null;
  } else if (formData.get("removeImage") && imageKey) {
    await storage.delete(imageKey);
    imageKey = null;
    sourceUrl = null;
  }

  const { title, subtitle, buttonText, linkUrl, bgColor, startAt, endAt } = data;
  const values = { title, subtitle, buttonText, linkUrl, bgColor, startAt, endAt, imageKey, sourceUrl, active: formData.get("active") === "on", showText: formData.get("showText") === "on", newTab: formData.get("newTab") === "on" || isExternalUrl(linkUrl) };
  if (id) {
    // Only an admin can keep a slide published: anyone else editing it sends it back for approval.
    await db.banner.update({ where: { id }, data: isAdmin(user.role) ? values : { ...values, published: false } });
  } else {
    const last = await db.banner.aggregate({ _max: { sortOrder: true } });
    await db.banner.create({ data: { ...values, sortOrder: (last._max.sortOrder ?? -1) + 1, createdById: user.id, published: isAdmin(user.role) } });
  }

  revalidatePath("/");
  revalidatePath("/admin/banners");
  redirect("/admin/banners");
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/banners");
}

/** Show / hide a slide without deleting it (managers). */
export async function toggleBanner(id: string) {
  await assertRole(isManager);
  const b = await db.banner.findUnique({ where: { id } });
  if (!b) return;
  await db.banner.update({ where: { id }, data: { active: !b.active } });
  refresh();
}

/** Approve / withdraw a slide for the public site (admins only). */
export async function setPublished(id: string, published: boolean) {
  await assertRole(isAdmin);
  await db.banner.update({ where: { id }, data: { published } });
  refresh();
}

/** Pin a slide to the front (admins only). */
export async function togglePin(id: string) {
  await assertRole(isAdmin);
  const b = await db.banner.findUnique({ where: { id } });
  if (!b) return;
  await db.banner.update({ where: { id }, data: { pinned: !b.pinned } });
  refresh();
}

/** Move a slide one step earlier/later among slides with the same pin state (managers). */
export async function moveBanner(id: string, direction: "up" | "down") {
  await assertRole(isManager);
  const list = await db.banner.findMany({ orderBy: [{ pinned: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true, pinned: true } });
  const i = list.findIndex((x) => x.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length || list[j].pinned !== list[i].pinned) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, order) => db.banner.update({ where: { id: x.id }, data: { sortOrder: order } })));
  refresh();
}

export async function deleteBanner(id: string) {
  const user = await assertRole(canAuthor);
  const b = await db.banner.findUnique({ where: { id } });
  if (!b) return;
  // Teachers can only withdraw their own slides that are not live yet.
  if (!isManager(user.role) && (b.createdById !== user.id || b.published)) throw new Error("Forbidden");
  if (b.imageKey) await getStorage().delete(b.imageKey);
  await db.banner.delete({ where: { id } });
  refresh();
}

// ---- slideshow look (applies to the whole "recommended" slideshow) ------------------------

const slideshowSchema = z.object({
  effect: z.enum(EFFECT_VALUES),
  layout: z.enum(["contained", "full"]),
  radius: z.coerce.number().int().min(0).max(32),
  interval: z.coerce.number().min(2).max(12),
});

export type SlideshowState = { error?: string; saved?: boolean } | undefined;

export async function saveSlideshow(_prev: SlideshowState, formData: FormData): Promise<SlideshowState> {
  await assertRole(isManager);
  const parsed = slideshowSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ค่าที่ตั้งไม่ถูกต้อง" };
  const d = parsed.data;

  const data = {
    slideEffect: d.effect,
    slideLayout: d.layout,
    slideRadius: d.radius,
    slideInterval: d.interval,
    slideAutoplay: formData.get("autoplay") === "on",
    slideArrows: formData.get("arrows") === "on",
    slideRandom: formData.get("random") === "on",
    slideShuffle: formData.get("shuffle") === "on",
  };
  await db.siteSetting.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });

  revalidatePath("/");
  revalidatePath("/admin/banners");
  return { saved: true };
}
