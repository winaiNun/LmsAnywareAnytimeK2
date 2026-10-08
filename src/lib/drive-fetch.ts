/**
 * Download Google Drive's own preview image (thumbnail) of a public file — images, and the first page of
 * a PDF. Server only. The host is fixed (drive.google.com) and the id is validated, so this cannot be
 * pointed at any other server. `DRIVE_THUMBNAIL_BASE` exists only so tests can use a local stand-in.
 */
import sharp from "sharp";
import { driveThumbnailUrl, parseDriveFileId } from "@/lib/drive";

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
// Below this, Drive has sent a generic file-type icon instead of a real preview.
const MIN_REAL_PREVIEW_WIDTH = 300;

export type DriveImage =
  | { ok: true; id: string; buffer: Buffer; mime: string; width: number; height: number }
  | { ok: false; error: string };

export async function fetchDriveImage(link: string, width = 1800): Promise<DriveImage> {
  const id = parseDriveFileId(link);
  if (!id) return { ok: false, error: "ลิงก์ไม่ถูกต้อง — ต้องเป็นลิงก์ไฟล์จาก drive.google.com เช่น https://drive.google.com/file/d/…/view" };

  const base = process.env.DRIVE_THUMBNAIL_BASE;
  const url = base ? `${base}?id=${encodeURIComponent(id)}&sz=w${width}` : driveThumbnailUrl(id, width);

  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "Mozilla/5.0 (compatible; LMS-thumbnail-fetch)", Accept: "image/*" } });
  } catch {
    return { ok: false, error: "เชื่อมต่อ Google Drive ไม่ได้ ลองใหม่อีกครั้ง" };
  }

  const type = (res.headers.get("content-type") ?? "").split(";")[0];
  if (!res.ok || !type.startsWith("image/")) {
    // Drive answers with an HTML sign-in / not-found page when the file is private or does not exist.
    return { ok: false, error: "ดึงภาพไม่ได้ — ตรวจสอบว่าไฟล์แชร์เป็น “ทุกคนที่มีลิงก์ (ผู้ดู)” และเป็นไฟล์ภาพหรือ PDF" };
  }
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return { ok: false, error: "ภาพตัวอย่างใหญ่เกินไป" };
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES) return { ok: false, error: "ภาพตัวอย่างใหญ่เกินไป" };

  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    return { ok: false, error: "ไฟล์ที่ได้จาก Drive ไม่ใช่รูปภาพที่อ่านได้" };
  }
  if (!meta.width || !meta.height) return { ok: false, error: "อ่านขนาดภาพไม่ได้" };
  if (meta.width < MIN_REAL_PREVIEW_WIDTH) return { ok: false, error: "Drive ไม่มีภาพตัวอย่างของไฟล์นี้ (ใช้ได้กับไฟล์ภาพและ PDF เท่านั้น)" };

  return { ok: true, id, buffer, mime: type, width: meta.width, height: meta.height };
}
