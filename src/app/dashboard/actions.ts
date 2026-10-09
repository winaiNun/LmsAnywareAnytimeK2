"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { profileData, profileSchema } from "@/lib/members";
import { headers } from "next/headers";
import { deviceLabel, hashToken, newDeviceToken, pinAllowed, pinProblem } from "@/lib/pin";

export type ProfileState = { error?: string; saved?: boolean } | undefined;

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "กรุณาเข้าสู่ระบบ" };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  if (parsed.data.schoolId && !(await db.school.findFirst({ where: { id: parsed.data.schoolId, active: true }, select: { id: true } }))) return { error: "ไม่พบโรงเรียนที่เลือก" };

  await db.user.update({ where: { id: session.user.id }, data: profileData(parsed.data) });
  await audit({ actorId: session.user.id, action: "user.profile-update", entity: "User", entityId: session.user.id });
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
