"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { profileData, profileSchema } from "@/lib/members";
import { pinAllowed, pinProblem } from "@/lib/pin";

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

/** Set or change the quick-sign-in PIN. Needs the account password so a borrowed phone cannot add one. */
export async function setPin(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
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

  await db.user.update({ where: { id: user.id }, data: { pinHash: await bcrypt.hash(pin, 10), pinFailCount: 0, pinLockedUntil: null } });
  await audit({ actorId: user.id, action: "user.pin-set", entity: "User", entityId: user.id });
  revalidatePath("/dashboard");
  return { saved: true };
}

export async function removePin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) return;
  await db.user.update({ where: { id: session.user.id }, data: { pinHash: null, pinFailCount: 0, pinLockedUntil: null } });
  await audit({ actorId: session.user.id, action: "user.pin-remove", entity: "User", entityId: session.user.id });
  revalidatePath("/dashboard");
}
