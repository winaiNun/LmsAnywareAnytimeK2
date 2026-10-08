"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDriveFileId } from "@/lib/drive";
import { refreshSchoolCard, storeUploadedCard } from "@/lib/school-card";

const MAX_CARD_BYTES = 4 * 1024 * 1024; // already cropped/shrunk in the browser; Vercel's request limit is ~4.5 MB
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const schema = z.object({
  siteUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https?:\/\/\S+$/.test(v), "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https:// และห้ามมีช่องว่าง"),
  cardSourceUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || parseDriveFileId(v) !== null, "ลิงก์การ์ดต้องเป็นลิงก์ไฟล์จาก drive.google.com"),
});

export type OwnSchoolState = { error?: string; warning?: string; saved?: boolean } | undefined;

/**
 * A school edits ITS OWN link and card. The school is found from the signed-in account — never from an id
 * sent by the browser — so one school can not touch another. Name, district, centre and e-mail stay admin-only.
 */
export async function saveOwnSchool(_prev: OwnSchoolState, formData: FormData): Promise<OwnSchoolState> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "กรุณาเข้าสู่ระบบ" };
  if (session.user.mustChange) return { error: "กรุณาเปลี่ยนรหัสผ่านก่อน" };

  const school = await db.school.findUnique({ where: { accountId: session.user.id } });
  if (!school) return { error: "บัญชีนี้ไม่ได้เชื่อมกับโรงเรียนใด" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { siteUrl, cardSourceUrl } = parsed.data;

  const upload = formData.get("card");
  const hasUpload = upload instanceof File && upload.size > 0;
  if (hasUpload) {
    if (!IMAGE_TYPES.includes(upload.type)) return { error: "รองรับเฉพาะไฟล์ PNG, JPG, WebP" };
    if (upload.size > MAX_CARD_BYTES) return { error: "ไฟล์รูปต้องไม่เกิน 4 MB" };
  }

  const sourceChanged = cardSourceUrl !== school.cardSourceUrl;
  await db.school.update({
    where: { id: school.id },
    data: { siteUrl, cardSourceUrl: hasUpload ? null : cardSourceUrl, updatedById: session.user.id, ...(sourceChanged && !hasUpload ? { cardStatus: school.cardKey ? "ok" : "none", cardError: null } : {}) },
  });

  let warning: string | undefined;
  if (hasUpload) {
    const r = await storeUploadedCard(school.id, Buffer.from(await upload.arrayBuffer()));
    if (!r.ok) return { error: r.error };
  } else if (sourceChanged && cardSourceUrl) {
    const r = await refreshSchoolCard(school.id);
    if (!r.ok) warning = `บันทึกลิงก์แล้ว แต่ดึงภาพการ์ดไม่สำเร็จ: ${r.error}`;
  }

  await audit({ actorId: session.user.id, action: "school.edit", entity: "School", entityId: school.id, meta: { by: "school" } });
  revalidatePath("/");
  revalidatePath("/schools");
  revalidatePath("/school");
  return warning ? { warning, saved: true } : { saved: true };
}
