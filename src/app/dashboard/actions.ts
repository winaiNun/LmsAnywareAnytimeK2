"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { BIO_MAX } from "@/lib/honors-rank";
import { AVATAR_OUT, MAX_ZOOM, clampCenter } from "@/lib/avatar";
import { parseDriveFileId, driveViewUrl } from "@/lib/drive";
import { fetchDriveImage } from "@/lib/drive-fetch";
import { processAvatar } from "@/lib/image";
import { rateLimited } from "@/lib/rate-limit";
import { getSiteInfo } from "@/lib/site";
import { getStorage } from "@/lib/storage";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { profileData, profileSchema } from "@/lib/members";
import { headers } from "next/headers";
import { deviceLabel, hashToken, newDeviceToken, pinAllowed, pinProblem } from "@/lib/pin";

export type ProfileState = { error?: string; saved?: boolean } | undefined;

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "กรุณาเข้าสู่ระบบ" };
  // A member cannot change their own type (it decides student protection, course audiences and the honours page): only an admin can.
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { memberType: true } });
  if (!me) return { error: "ไม่พบบัญชี" };
  const parsed = profileSchema.safeParse({ ...Object.fromEntries(formData), memberType: me.memberType });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  if (parsed.data.schoolId && !(await db.school.findFirst({ where: { id: parsed.data.schoolId, active: true }, select: { id: true } }))) return { error: "ไม่พบโรงเรียนที่เลือก" };

  await db.user.update({ where: { id: session.user.id }, data: profileData(parsed.data) });
  await audit({ actorId: session.user.id, action: "user.profile-update", entity: "User", entityId: session.user.id });
  revalidatePath("/dashboard");
  return { saved: true };
}

const honorsSchema = z.object({ honorsBio: z.string().trim().max(BIO_MAX, `ข้อความแนะนำตัวไม่เกิน ${BIO_MAX} ตัวอักษร`).default("") });

/**
 * "Show me on the honours page": the member's own choice (opt-in). Students cannot switch it on: a minor never appears,
 * and the page's queries also exclude them, so this is only the friendly error.
 */
export async function saveHonorsPrefs(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "กรุณาเข้าสู่ระบบ" };
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { memberType: true } });
  if (!me) return { error: "ไม่พบบัญชี" };
  const show = formData.get("showInHonors") === "on";
  if (show && me.memberType === "STUDENT") return { error: "สมาชิกประเภทนักเรียนไม่แสดงในหน้าเชิดชูเพื่อคุ้มครองข้อมูลของผู้เยาว์" };
  const parsed = honorsSchema.safeParse({ honorsBio: String(formData.get("honorsBio") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  await db.user.update({
    where: { id: session.user.id },
    // switched off: only the consent changes (the other boxes are disabled in the form, so keep what was chosen before)
    data: show
      ? { showInHonors: true, honorsShowPhoto: formData.get("honorsShowPhoto") === "on", honorsShowSchool: formData.get("honorsShowSchool") === "on", honorsBio: parsed.data.honorsBio || null }
      : { showInHonors: false },
  });
  await audit({ actorId: session.user.id, action: "user.honors-prefs", entity: "User", entityId: session.user.id, meta: { show } });
  revalidateTag("honors");
  revalidatePath("/honors");
  revalidatePath("/dashboard");
  return { saved: true };
}

/** A member asks to become a course creator; an admin approves on /admin/users. */
export async function requestCreator(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "กรุณาเข้าสู่ระบบ" };
  const reason = z.string().trim().min(10, "กรุณาบอกเหตุผลอย่างน้อย 10 ตัวอักษร").max(500).safeParse(formData.get("reason"));
  if (!reason.success) return { error: reason.error.issues[0].message };

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true, creatorStatus: true } });
  if (!user) return { error: "ไม่พบบัญชีผู้ใช้" };
  if (user.role !== "STUDENT") return { error: "บัญชีของคุณมีสิทธิ์สร้างเนื้อหาอยู่แล้ว" };
  if (user.creatorStatus === "PENDING") return { error: "ส่งคำขอไว้แล้ว รอผู้ดูแลพิจารณา" };

  await db.user.update({ where: { id: session.user.id }, data: { creatorStatus: "PENDING", creatorReason: reason.data } });
  await audit({ actorId: session.user.id, action: "creator.request", entity: "User", entityId: session.user.id });
  revalidatePath("/dashboard");
  revalidatePath("/admin/users");
  return { saved: true };
}

export type PinState = { error?: string; saved?: boolean; token?: string; name?: string } | undefined;

/**
 * Set a PIN for THIS phone. Needs the account password so a borrowed phone cannot add one.
 * With `token` of a device that already exists the PIN is changed, otherwise a new device is registered
 * and its secret token is returned once for the phone to keep.
 */
export async function setPin(formData: FormData): Promise<PinState> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "กรุณาเข้าสู่ระบบ" };
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.active) return { error: "ไม่พบบัญชีผู้ใช้" };
  if (!pinAllowed(user.role)) return { error: "บัญชีผู้ดูแล/บรรณารักษ์ใช้ PIN ไม่ได้ เพื่อความปลอดภัย" };

  const pin = String(formData.get("pin") ?? "");
  if (pin !== String(formData.get("confirm") ?? "")) return { error: "PIN ทั้งสองช่องไม่ตรงกัน" };
  const bad = pinProblem(pin);
  if (bad) return { error: bad };
  if (!(await bcrypt.compare(String(formData.get("password") ?? ""), user.passwordHash))) return { error: "รหัสผ่านไม่ถูกต้อง" };

  const pinHash = await bcrypt.hash(pin, 10);
  const oldToken = String(formData.get("token") ?? "");
  const existing = /^[0-9a-f]{64}$/.test(oldToken) ? await db.trustedDevice.findFirst({ where: { tokenHash: hashToken(oldToken), userId: user.id } }) : null;
  if (existing) {
    await db.trustedDevice.update({ where: { id: existing.id }, data: { pinHash, failCount: 0 } });
    await audit({ actorId: user.id, action: "user.pin-change", entity: "User", entityId: user.id });
    revalidatePath("/dashboard");
    return { saved: true, token: oldToken, name: user.name };
  }
  const token = newDeviceToken();
  await db.trustedDevice.create({ data: { userId: user.id, tokenHash: hashToken(token), pinHash, label: deviceLabel(headers().get("user-agent") ?? "") } });
  await audit({ actorId: user.id, action: "user.pin-set", entity: "User", entityId: user.id });
  revalidatePath("/dashboard");
  return { saved: true, token, name: user.name };
}

/** Forget one phone (own devices only). */
export async function removeDevice(id: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) return;
  await db.trustedDevice.deleteMany({ where: { id, userId: session.user.id } });
  await audit({ actorId: session.user.id, action: "user.pin-remove", entity: "User", entityId: session.user.id });
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------------------------
// Profile picture. Two ways in: upload (only while the admin allows server uploads) or a public Google
// Drive link, which is shown straight from Drive's thumbnail with a stored circular crop window.
// ---------------------------------------------------------------------------------------------

export type AvatarState = { error?: string; saved?: boolean } | undefined;

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

async function requireMember() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export type DriveAvatarPreview =
  | { ok: true; id: string; dataUrl: string; width: number; height: number }
  | { ok: false; error: string };

/** Step 1 for Drive: fetch the public thumbnail so the browser can show the circular crop dialog. */
export async function fetchAvatarFromDrive(link: string): Promise<DriveAvatarPreview> {
  const user = await requireMember();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  if (rateLimited(`avatar-fetch:${user.id}`, 20, 10 * 60 * 1000)) return { ok: false, error: "ดึงภาพบ่อยเกินไป กรุณารอสักครู่" };
  const img = await fetchDriveImage(link, 800);
  if (!img.ok) return img;
  return { ok: true, id: img.id, dataUrl: `data:${img.mime};base64,${img.buffer.toString("base64")}`, width: img.width, height: img.height };
}

const driveSchema = z.object({
  link: z.string().max(500),
  cx: z.number().min(0).max(1),
  cy: z.number().min(0).max(1),
  zoom: z.number().min(1).max(MAX_ZOOM),
  aspect: z.number().min(0.2).max(5),
});

/** Step 2 for Drive: keep only the link (no file) and the crop window. */
export async function saveAvatarDrive(input: z.infer<typeof driveSchema>): Promise<AvatarState> {
  const user = await requireMember();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };
  const parsed = driveSchema.safeParse(input);
  if (!parsed.success) return { error: "ข้อมูลการครอบรูปไม่ถูกต้อง" };
  const id = parseDriveFileId(parsed.data.link);
  if (!id) return { error: "ลิงก์ไม่ถูกต้อง — ต้องเป็นลิงก์ไฟล์จาก drive.google.com" };

  const { cx, cy } = clampCenter(parsed.data.cx, parsed.data.cy, parsed.data.zoom, parsed.data.aspect);
  const old = await db.user.findUnique({ where: { id: user.id }, select: { avatarKey: true } });
  await db.user.update({ where: { id: user.id }, data: { avatarKey: null, avatarDriveId: id, avatarCx: cx, avatarCy: cy, avatarZoom: parsed.data.zoom, avatarAspect: parsed.data.aspect } });
  if (old?.avatarKey) await getStorage().delete(old.avatarKey).catch(() => {});
  await audit({ actorId: user.id, action: "user.avatar-drive", entity: "User", entityId: user.id, meta: { view: driveViewUrl(id) } });
  revalidatePath("/dashboard");
  return { saved: true };
}

/** Upload path: the browser already cropped a square; we re-validate and re-encode it. Admin switch must be on. */
export async function saveAvatarUpload(formData: FormData): Promise<AvatarState> {
  const user = await requireMember();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };
  if (!(await getSiteInfo()).allowServerUploads) return { error: "ขณะนี้ผู้ดูแลปิดการอัปโหลดรูปเข้าเซิร์ฟเวอร์ — ใช้ลิงก์ Google Drive แทน" };
  if (rateLimited(`avatar-up:${user.id}`, 10, 10 * 60 * 1000)) return { error: "อัปโหลดบ่อยเกินไป กรุณารอสักครู่" };
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกรูป" };
  if (file.size > MAX_AVATAR_BYTES) return { error: "ไฟล์ใหญ่เกินไป (ไม่เกิน 4 MB)" };

  let processed: Buffer;
  try {
    processed = await processAvatar(Buffer.from(await file.arrayBuffer()), AVATAR_OUT);
  } catch {
    return { error: "ไฟล์นี้ไม่ใช่รูปภาพที่อ่านได้" };
  }
  const storage = getStorage();
  const key = `avatars/${user.id}-${randomUUID().slice(0, 8)}.webp`;
  await storage.put(key, processed, "image/webp");
  const old = await db.user.findUnique({ where: { id: user.id }, select: { avatarKey: true } });
  await db.user.update({ where: { id: user.id }, data: { avatarKey: key, avatarDriveId: null, avatarCx: 0.5, avatarCy: 0.5, avatarZoom: 1, avatarAspect: 1 } });
  if (old?.avatarKey) await storage.delete(old.avatarKey).catch(() => {});
  await audit({ actorId: user.id, action: "user.avatar-upload", entity: "User", entityId: user.id });
  revalidatePath("/dashboard");
  return { saved: true };
}

export async function removeAvatar(): Promise<void> {
  const user = await requireMember();
  if (!user) return;
  const old = await db.user.findUnique({ where: { id: user.id }, select: { avatarKey: true } });
  await db.user.update({ where: { id: user.id }, data: { avatarKey: null, avatarDriveId: null, avatarCx: 0.5, avatarCy: 0.5, avatarZoom: 1, avatarAspect: 1 } });
  if (old?.avatarKey) await getStorage().delete(old.avatarKey).catch(() => {});
  revalidatePath("/dashboard");
}
