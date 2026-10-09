"use server";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  current: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
  next: z.string().min(8, "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร").max(100),
  confirm: z.string(),
});

export type PasswordState = { error?: string; done?: boolean } | undefined;

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "กรุณาเข้าสู่ระบบ" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { current, next, confirm } = parsed.data;
  if (next !== confirm) return { error: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" };
  if (next === current) return { error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" };

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.active) return { error: "ไม่พบบัญชีผู้ใช้" };
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
  const local = (user.email ?? "").split("@")[0].toLowerCase();
  if (local && next.toLowerCase().includes(local)) return { error: "รหัสผ่านต้องไม่มีส่วนของอีเมลหรือชื่อผู้ใช้" };

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false } });
  await db.trustedDevice.deleteMany({ where: { userId: user.id } }); // PINs set with the old password stop working
  await audit({ actorId: user.id, action: "user.password-change", entity: "User", entityId: user.id });
  return { done: true };
}
