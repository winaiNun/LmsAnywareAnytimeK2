/**
 * Keep a school's card picture: take Drive's thumbnail ONCE, shrink it, store it as WebP in our own
 * (public) storage and remember where it came from. The public site then serves only our small copy.
 */
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { fetchDriveImage } from "@/lib/drive-fetch";
import { storageIsDurable } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";
import { getStorage } from "@/lib/storage";

const CARD_WIDTH = 960; // px; cards are ~16:9 and shown at most ~300 px wide ×2 for high-DPI

export type CardResult = { ok: true; key: string } | { ok: false; error: string };

/** Fetch (or re-fetch) the card of one school from its `cardSourceUrl`. Updates the row either way. */
export async function refreshSchoolCard(schoolId: string): Promise<CardResult> {
  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) return { ok: false, error: "ไม่พบโรงเรียน" };
  if (!school.cardSourceUrl) {
    await db.school.update({ where: { id: schoolId }, data: { cardStatus: "none", cardError: null } });
    return { ok: false, error: "ไม่มีลิงก์การ์ด" };
  }

  // No durable file storage yet: the public site shows the Drive thumbnail straight from the saved link.
  if (!storageIsDurable()) {
    await db.school.update({ where: { id: schoolId }, data: { cardStatus: "ok", cardError: null } });
    return { ok: true, key: "" };
  }

  const img = await fetchDriveImage(school.cardSourceUrl, 1200);
  if (!img.ok) {
    // keep any picture we already have; only record the failure
    await db.school.update({ where: { id: schoolId }, data: { cardStatus: school.cardKey ? "ok" : "failed", cardError: img.error, cardFetchedAt: new Date() } });
    return img;
  }

  let webp: Buffer;
  try {
    webp = await sharp(img.buffer).rotate().resize({ width: CARD_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch {
    await db.school.update({ where: { id: schoolId }, data: { cardStatus: school.cardKey ? "ok" : "failed", cardError: "แปลงภาพไม่สำเร็จ", cardFetchedAt: new Date() } });
    return { ok: false, error: "แปลงภาพไม่สำเร็จ" };
  }

  const storage = getStorage();
  const key = `schools/${school.code}-${randomBytes(4).toString("hex")}.webp`; // new key each time → no stale CDN cache
  await storage.put(key, webp, "image/webp");
  await db.school.update({ where: { id: schoolId }, data: { cardKey: key, cardStatus: "ok", cardError: null, cardFetchedAt: new Date() } });
  if (school.cardKey) await storage.delete(school.cardKey).catch(() => {});
  return { ok: true, key };
}

/** Store a card the school/admin uploaded directly (already cropped in the browser). */
export async function storeUploadedCard(schoolId: string, input: Buffer): Promise<CardResult> {
  if (!storageIsDurable() || !(await getSiteInfo()).allowServerUploads) return { ok: false, error: "ขณะนี้ปิดการอัปโหลดภาพเข้าเซิร์ฟเวอร์ — ใช้ลิงก์ Google Drive แทน" };
  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) return { ok: false, error: "ไม่พบโรงเรียน" };
  let webp: Buffer;
  try {
    webp = await sharp(input).rotate().resize({ width: CARD_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch {
    return { ok: false, error: "ไฟล์รูปเสียหรืออ่านไม่ได้" };
  }
  const storage = getStorage();
  const key = `schools/${school.code}-${randomBytes(4).toString("hex")}.webp`;
  await storage.put(key, webp, "image/webp");
  await db.school.update({ where: { id: schoolId }, data: { cardKey: key, cardStatus: "ok", cardError: null, cardSourceUrl: null, cardFetchedAt: new Date() } });
  if (school.cardKey) await storage.delete(school.cardKey).catch(() => {});
  return { ok: true, key };
}
