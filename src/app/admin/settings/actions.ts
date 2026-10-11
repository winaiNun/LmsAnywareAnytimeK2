"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { processLogo } from "@/lib/image";
import { getStorage } from "@/lib/storage";

// Vercel rejects request bodies over ~4.5 MB, so keep uploads that pass through the server below that.
const MAX_LOGO_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const VIDEO_EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };
// Only keys we generated ourselves are accepted back from the browser.
const HERO_KEY = /^site\/hero-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$/;

export type VideoUploadTarget = { direct: false } | { direct: true; key: string; url: string; contentType: string } | { error: string };

/**
 * Step 1 of a direct upload: the browser asks where to PUT the video. Only storage drivers that can
 * hand out a signed URL (s3/R2) support it; otherwise the file is posted with the form as before.
 */
export async function requestVideoUpload(mimeType: string, size: number): Promise<VideoUploadTarget> {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) throw new Error("Forbidden");

  const ext = VIDEO_EXT[mimeType];
  if (!ext) return { error: "วิดีโอรองรับเฉพาะ MP4 หรือ WebM" };
  if (!(size > 0) || size > MAX_VIDEO_BYTES) return { error: "วิดีโอต้องไม่เกิน 30 MB (แนะนำบีบอัดให้เล็กกว่า 15 MB)" };

  const storage = getStorage();
  if (!storage.presignUpload) return { direct: false };
  const key = `site/hero-${randomUUID()}.${ext}`;
  return { direct: true, key, url: await storage.presignUpload(key, mimeType), contentType: mimeType };
}

const schema = z.object({
  systemName: z.string().trim().min(1, "กรุณากรอกชื่อระบบ").max(80),
  areaName: z.string().trim().max(120).default(""),
  tagline: z.string().trim().max(200).default(""),
  heroBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "สีไม่ถูกต้อง"),
  overlayOpacity: z.coerce.number().int().min(0).max(90),
  fadeSeconds: z.coerce.number().min(0).max(5),
});

export type SettingsState = { error?: string; saved?: boolean } | undefined;

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) throw new Error("Forbidden");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await db.siteSetting.findUnique({ where: { id: "main" } });
  const storage = getStorage();
  let logoKey = existing?.logoKey ?? null;
  let heroVideoKey = existing?.heroVideoKey ?? null;
  const toDelete: string[] = [];

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!IMAGE_TYPES.includes(logo.type)) return { error: "โลโก้รองรับเฉพาะ PNG, JPG, WebP" };
    if (logo.size > MAX_LOGO_BYTES) return { error: "ไฟล์โลโก้ต้องไม่เกิน 4 MB" };
    let data: Buffer;
    try {
      data = await processLogo(Buffer.from(await logo.arrayBuffer()));
    } catch {
      return { error: "ไฟล์โลโก้เสียหรืออ่านไม่ได้" };
    }
    const key = `site/logo-${randomUUID()}.webp`;
    await storage.put(key, data, "image/webp");
    if (logoKey) toDelete.push(logoKey);
    logoKey = key;
  } else if (formData.get("removeLogo") && logoKey) {
    toDelete.push(logoKey);
    logoKey = null;
  }

  // A video already uploaded straight to the bucket from the browser (see requestVideoUpload).
  const uploadedKey = String(formData.get("heroVideoKeyUploaded") ?? "");
  const video = formData.get("video");
  if (uploadedKey) {
    if (!HERO_KEY.test(uploadedKey)) return { error: "ข้อมูลวิดีโอไม่ถูกต้อง" };
    if (heroVideoKey && heroVideoKey !== uploadedKey) toDelete.push(heroVideoKey);
    heroVideoKey = uploadedKey;
  } else if (video instanceof File && video.size > 0) {
    const ext = VIDEO_EXT[video.type];
    if (!ext) return { error: "วิดีโอรองรับเฉพาะ MP4 หรือ WebM" };
    if (video.size > MAX_VIDEO_BYTES) return { error: "วิดีโอต้องไม่เกิน 30 MB (แนะนำบีบอัดให้เล็กกว่า 15 MB)" };
    const key = `site/hero-${randomUUID()}.${ext}`;
    await storage.put(key, Buffer.from(await video.arrayBuffer()), video.type);
    if (heroVideoKey) toDelete.push(heroVideoKey);
    heroVideoKey = key;
  } else if (formData.get("removeVideo") && heroVideoKey) {
    toDelete.push(heroVideoKey);
    heroVideoKey = null;
  }

  const data = { ...parsed.data, logoKey, heroVideoKey, logoBackdrop: formData.get("logoBackdrop") === "on", allowServerUploads: formData.get("allowServerUploads") === "on", requireRegistrationCode: formData.get("requireRegistrationCode") === "on" };
  await db.siteSetting.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });
  await Promise.all(toDelete.map((k) => storage.delete(k)));

  revalidatePath("/", "layout");
  return { saved: true };
}
