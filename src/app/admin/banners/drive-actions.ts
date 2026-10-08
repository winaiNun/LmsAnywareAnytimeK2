"use server";

import sharp from "sharp";
import { driveThumbnailUrl, driveViewUrl, parseDriveFileId } from "@/lib/drive";
import { assertRole, canAuthor } from "@/lib/permissions";

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
// Below this, Drive has sent a generic file-type icon instead of a real preview.
const MIN_REAL_PREVIEW_WIDTH = 300;

export type DrivePreview =
  | { ok: true; id: string; dataUrl: string; mime: string; width: number; height: number; bytes: number; viewUrl: string }
  | { ok: false; error: string };

/**
 * Step 1 of "image from Google Drive": download the public thumbnail so the browser can show it in the
 * crop dialog. The host is fixed (drive.google.com) and the id is validated, so this cannot be pointed
 * at other servers. `DRIVE_THUMBNAIL_BASE` exists only so automated tests can use a local stand-in.
 */
export async function fetchDriveThumbnail(link: string): Promise<DrivePreview> {
  await assertRole(canAuthor);

  const id = parseDriveFileId(link);
  if (!id) return { ok: false, error: "ลิงก์ไม่ถูกต้อง — ต้องเป็นลิงก์ไฟล์จาก drive.google.com เช่น https://drive.google.com/file/d/…/view" };

  const base = process.env.DRIVE_THUMBNAIL_BASE;
  const url = base ? `${base}?id=${encodeURIComponent(id)}&sz=w1800` : driveThumbnailUrl(id, 1800);

  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "Mozilla/5.0 (compatible; LMS-thumbnail-fetch)", Accept: "image/*" } });
  } catch {
    return { ok: false, error: "เชื่อมต่อ Google Drive ไม่ได้ ลองใหม่อีกครั้ง" };
  }

  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) {
    // Drive answers with an HTML sign-in / not-found page when the file is private or does not exist.
    return { ok: false, error: "ดึงภาพไม่ได้ — ตรวจสอบว่าไฟล์แชร์เป็น “ทุกคนที่มีลิงก์ (ผู้ดู)” และเป็นไฟล์ภาพหรือ PDF" };
  }

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return { ok: false, error: "ภาพตัวอย่างใหญ่เกินไป" };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) return { ok: false, error: "ภาพตัวอย่างใหญ่เกินไป" };

  let meta;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    return { ok: false, error: "ไฟล์ที่ได้จาก Drive ไม่ใช่รูปภาพที่อ่านได้" };
  }
  if (!meta.width || !meta.height) return { ok: false, error: "อ่านขนาดภาพไม่ได้" };
  if (meta.width < MIN_REAL_PREVIEW_WIDTH) {
    return { ok: false, error: "Drive ไม่มีภาพตัวอย่างของไฟล์นี้ (ใช้ได้กับไฟล์ภาพและ PDF เท่านั้น)" };
  }

  return {
    ok: true,
    id,
    dataUrl: `data:${type.split(";")[0]};base64,${buf.toString("base64")}`,
    mime: type.split(";")[0],
    width: meta.width,
    height: meta.height,
    bytes: buf.length,
    viewUrl: driveViewUrl(id),
  };
}
