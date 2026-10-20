"use server";

import { randomUUID } from "node:crypto";
import { fetchDriveImage } from "@/lib/drive-fetch";
import { processBackground } from "@/lib/image";
import { assertRole, canAuthor } from "@/lib/permissions";
import { rateLimited } from "@/lib/rate-limit";
import { getSiteInfo } from "@/lib/site";
import { getStorage } from "@/lib/storage";

/** Pictures and Drive previews for page/lesson text (the editor toolbar calls these). Everything is re-encoded as a small WebP. */
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const A4_WIDTH = 1240; // A4 at about 150 dpi: sharp enough to read, a few hundred KB

export type ContentResult = { ok: true; key: string } | { ok: false; error: string };

export async function uploadContentImage(f: FormData): Promise<ContentResult> {
  const actor = await assertRole(canAuthor);
  if (!(await getSiteInfo()).allowServerUploads) return { ok: false, error: "ขณะนี้ปิดการอัปโหลดรูปเข้าเซิร์ฟเวอร์ (แอดมินเปิดได้ที่ ตั้งค่าเขตพื้นที่) — ใช้ลิงก์ Google Drive แทน" };
  if (rateLimited(`content-img:${actor.id}`, 30, 10 * 60 * 1000)) return { ok: false, error: "อัปโหลดบ่อยเกินไป กรุณารอสักครู่" };
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "กรุณาเลือกรูปและกด “ใช้รูปนี้” ในหน้าต่างครอบรูปก่อน" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "ไฟล์ใหญ่เกินไป (ไม่เกิน 6 MB)" };
  let data: Buffer;
  try {
    data = await processBackground(Buffer.from(await file.arrayBuffer()), A4_WIDTH);
  } catch {
    return { ok: false, error: "ไฟล์นี้ไม่ใช่รูปภาพที่อ่านได้" };
  }
  const key = `content/${randomUUID()}.webp`;
  await getStorage().put(key, data, "image/webp");
  return { ok: true, key };
}

export type ContentDriveResult = { ok: true; id: string; thumbKey: string | null; note?: string } | { ok: false; error: string };

/** A Drive link (PDF or image): keep Drive's first-page preview as a small WebP of ours; the file itself stays in Drive. */
export async function addContentDrive(link: string): Promise<ContentDriveResult> {
  const actor = await assertRole(canAuthor);
  if (rateLimited(`content-drive:${actor.id}`, 20, 10 * 60 * 1000)) return { ok: false, error: "ดึงภาพบ่อยเกินไป กรุณารอสักครู่" };
  const img = await fetchDriveImage(link, 1240);
  if (!img.ok) return img;
  let data: Buffer;
  try {
    data = await processBackground(img.buffer, 900);
  } catch {
    return { ok: false, error: "ไฟล์ที่ได้จาก Drive ไม่ใช่รูปภาพที่อ่านได้" };
  }
  const key = `content/${randomUUID()}.webp`;
  await getStorage().put(key, data, "image/webp");
  return { ok: true, id: img.id, thumbKey: key };
}
