"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { emailField, profileData, profileSchema, usernameField } from "@/lib/members";
import { generateTempPassword } from "@/lib/password";
import { assertRole, isAdmin } from "@/lib/permissions";

export type UserFormState = { error?: string; saved?: boolean; id?: string; tempPassword?: string } | undefined;

const ROLES = ["ADMIN", "LIBRARIAN", "TEACHER", "STUDENT"] as const;

const accountSchema = z.object({
  email: emailField.optional().or(z.literal("").transform(() => undefined)),
  username: usernameField.optional().or(z.literal("").transform(() => undefined)),
  role: z.enum(ROLES),
});

function refresh(id?: string) {
  revalidatePath("/admin/users");
  if (id) revalidatePath(`/admin/users/${id}`);
}

async function lastAdminGuard(id: string, becomesNonAdmin: boolean) {
  if (!becomesNonAdmin) return null;
  const others = await db.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
  return others === 0 ? "ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน" : null;
}

async function duplicate(id: string | null, email?: string, username?: string) {
  const not = id ? { id: { not: id } } : {};
  if (email && (await db.user.findFirst({ where: { email, ...not }, select: { id: true } }))) return "อีเมลนี้ถูกใช้แล้ว";
  if (username && (await db.user.findFirst({ where: { username, ...not }, select: { id: true } }))) return "ชื่อผู้ใช้นี้ถูกใช้แล้ว";
  return null;
}

async function checkSchool(schoolId?: string) {
  return schoolId && !(await db.school.findUnique({ where: { id: schoolId }, select: { id: true } })) ? "ไม่พบโรงเรียนที่เลือก" : null;
}

/** Admin creates an account; the password is generated (shown once) unless typed in. */
export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await assertRole(isAdmin);
  const raw = Object.fromEntries(formData);
  const account = accountSchema.safeParse(raw);
  const profile = profileSchema.safeParse(raw);
  if (!account.success) return { error: account.error.issues[0].message };
  if (!profile.success) return { error: profile.error.issues[0].message };
  if (!account.data.email && !account.data.username) return { error: "กรุณากรอกอีเมลหรือชื่อผู้ใช้อย่างน้อยหนึ่งอย่าง" };
  const typed = String(raw.password ?? "");
  if (typed && typed.length < 8) return { error: "รหัสผ่านอย่างน้อย 8 ตัว" };

  const err = (await duplicate(null, account.data.email, account.data.username)) ?? (await checkSchool(profile.data.schoolId));
  if (err) return { error: err };

  const password = typed || generateTempPassword();
  const user = await db.user.create({
    data: { ...profileData(profile.data), email: account.data.email ?? null, username: account.data.username ?? null, role: account.data.role, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true },
    select: { id: true },
  });
  await audit({ actorId: actor.id, action: "user.create", entity: "User", entityId: user.id, meta: { role: account.data.role } });
  refresh();
  return { saved: true, id: user.id, tempPassword: password };
}

export async function saveUser(id: string, _prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await assertRole(isAdmin);
  const raw = Object.fromEntries(formData);
  const account = accountSchema.safeParse(raw);
  const profile = profileSchema.safeParse(raw);
  if (!account.success) return { error: account.error.issues[0].message };
  if (!profile.success) return { error: profile.error.issues[0].message };
  if (!account.data.email && !account.data.username) return { error: "ต้องมีอีเมลหรือชื่อผู้ใช้อย่างน้อยหนึ่งอย่าง" };
  const active = formData.get("active") === "on";

  const existing = await db.user.findUnique({ where: { id }, select: { role: true, active: true } });
  if (!existing) return { error: "ไม่พบผู้ใช้" };
  const err =
    (await duplicate(id, account.data.email, account.data.username)) ??
    (await checkSchool(profile.data.schoolId)) ??
    (await lastAdminGuard(id, existing.role === "ADMIN" && (account.data.role !== "ADMIN" || !active)));
  if (err) return { error: err };

  await db.user.update({
    where: { id },
    data: { ...profileData(profile.data), email: account.data.email ?? null, username: account.data.username ?? null, role: account.data.role, active },
  });
  await audit({ actorId: actor.id, action: "user.update", entity: "User", entityId: id, meta: { role: account.data.role, active } });
  refresh(id);
  return { saved: true };
}

/** Sets a new temporary password (forces a change at next login). Returned once, never stored in clear. */
export async function resetPassword(id: string, typed?: string): Promise<{ error?: string; password?: string }> {
  const actor = await assertRole(isAdmin);
  if (typed && typed.length < 8) return { error: "รหัสผ่านอย่างน้อย 8 ตัว" };
  const password = typed || generateTempPassword();
  const r = await db.user.updateMany({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true } });
  await db.trustedDevice.deleteMany({ where: { userId: id } });
  if (!r.count) return { error: "ไม่พบผู้ใช้" };
  await audit({ actorId: actor.id, action: "user.password-reset", entity: "User", entityId: id });
  return { password };
}

/** Hard delete only when nothing hangs off the account; otherwise the admin is told to disable it instead. */
export async function deleteUser(id: string): Promise<{ error?: string }> {
  const actor = await assertRole(isAdmin);
  if (id === actor.id) return { error: "ลบบัญชีของตัวเองไม่ได้" };
  const u = await db.user.findUnique({
    where: { id },
    select: { role: true, name: true, school: { select: { id: true } }, _count: { select: { loans: true, enrollments: true, banners: true } } },
  });
  if (!u) return { error: "ไม่พบผู้ใช้" };
  if (u.school) return { error: "นี่คือบัญชีของโรงเรียน — จัดการที่เมนูโรงเรียน" };
  if (u._count.loans || u._count.enrollments || u._count.banners) return { error: "บัญชีนี้มีประวัติการยืม/เรียน/สไลด์ ลบไม่ได้ — ให้ปิดการใช้งานแทน" };
  const err = await lastAdminGuard(id, u.role === "ADMIN");
  if (err) return { error: err };

  await db.user.delete({ where: { id } });
  await audit({ actorId: actor.id, action: "user.delete", entity: "User", entityId: id, meta: { name: u.name } });
  refresh();
  return {};
}

/** Approve (→ TEACHER = course creator) or reject a "become a course creator" request. */
export async function decideCreator(id: string, approve: boolean): Promise<{ error?: string }> {
  const actor = await assertRole(isAdmin);
  const u = await db.user.findUnique({ where: { id }, select: { role: true, creatorStatus: true } });
  if (!u || u.creatorStatus !== "PENDING") return { error: "ไม่พบคำขอที่รอพิจารณา" };
  await db.user.update({
    where: { id },
    data: approve ? { creatorStatus: "APPROVED", role: u.role === "STUDENT" ? "TEACHER" : u.role } : { creatorStatus: "REJECTED" },
  });
  await audit({ actorId: actor.id, action: approve ? "creator.approve" : "creator.reject", entity: "User", entityId: id });
  refresh(id);
  return {};
}
