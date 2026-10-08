"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { processCover } from "@/lib/image";
import { getStorage } from "@/lib/storage";

// Originals can be big: they are cropped to 3:1 and shrunk to WebP before saving.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

async function requireStaff() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    throw new Error("Forbidden");
  }
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || null);

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "วันที่ไม่ถูกต้อง");

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
    .refine((v) => v === null || /^(\/(?!\/)|https?:\/\/)/.test(v), "ลิงก์ต้องขึ้นต้นด้วย / หรือ http(s)://"),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "สีไม่ถูกต้อง").default("#EAF0FF"),
  focusX: z.coerce.number().min(0).max(100).default(50),
  focusY: z.coerce.number().min(0).max(100).default(50),
  sortOrder: z.coerce.number().int().min(-9999).max(9999).default(0),
  startAt: optionalDate,
  endAt: optionalDate,
});

export type BannerFormState = { error?: string } | undefined;

export async function saveBanner(id: string | null, _prev: BannerFormState, formData: FormData): Promise<BannerFormState> {
  await requireStaff();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;
  if (data.startAt && data.endAt && data.endAt < data.startAt) {
    return { error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มแสดง" };
  }

  const existing = id ? await db.banner.findUnique({ where: { id } }) : null;
  if (id && !existing) return { error: "ไม่พบแบนเนอร์" };

  let imageKey = existing?.imageKey ?? null;
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
  } else if (formData.get("removeImage") && imageKey) {
    await storage.delete(imageKey);
    imageKey = null;
  }

  const { title, subtitle, buttonText, linkUrl, bgColor, sortOrder, startAt, endAt } = data;
  const values = { title, subtitle, buttonText, linkUrl, bgColor, sortOrder, startAt, endAt, imageKey, active: formData.get("active") === "on", showText: formData.get("showText") === "on" };
  if (id) await db.banner.update({ where: { id }, data: values });
  else await db.banner.create({ data: values });

  revalidatePath("/");
  revalidatePath("/admin/banners");
  redirect("/admin/banners");
}

export async function toggleBanner(id: string) {
  await requireStaff();
  const b = await db.banner.findUnique({ where: { id } });
  if (!b) return;
  await db.banner.update({ where: { id }, data: { active: !b.active } });
  revalidatePath("/");
  revalidatePath("/admin/banners");
}

export async function deleteBanner(id: string) {
  await requireStaff();
  const b = await db.banner.findUnique({ where: { id } });
  if (!b) return;
  if (b.imageKey) await getStorage().delete(b.imageKey);
  await db.banner.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/admin/banners");
}
