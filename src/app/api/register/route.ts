import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { emailField, profileData, profileSchema, usernameField } from "@/lib/members";
import { clientIp, rateLimited } from "@/lib/rate-limit";

const schema = z
  .object({
    email: emailField.optional().or(z.literal("").transform(() => undefined)),
    username: usernameField.optional().or(z.literal("").transform(() => undefined)),
    password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัว").max(100),
    consent: z.literal(true, { error: "กรุณายอมรับการเก็บและใช้ข้อมูลส่วนบุคคล" }),
  })
  .and(profileSchema);

export async function POST(req: Request) {
  if (rateLimited(`register:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "ลองสมัครบ่อยเกินไป กรุณารอสักครู่" }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const d = parsed.data;
  if (!d.email && !d.username) return NextResponse.json({ error: "กรุณากรอกอีเมลหรือชื่อผู้ใช้อย่างน้อยหนึ่งอย่าง" }, { status: 400 });

  if (d.email && (await db.user.findUnique({ where: { email: d.email } }))) return NextResponse.json({ error: "อีเมลนี้ถูกใช้แล้ว" }, { status: 409 });
  if (d.username && (await db.user.findUnique({ where: { username: d.username } }))) return NextResponse.json({ error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" }, { status: 409 });
  if (d.schoolId && !(await db.school.findFirst({ where: { id: d.schoolId, active: true }, select: { id: true } }))) {
    return NextResponse.json({ error: "ไม่พบโรงเรียนที่เลือก" }, { status: 400 });
  }

  // Self-registration is always STUDENT (the permission role); staff roles are granted by an admin.
  const user = await db.user.create({
    data: { ...profileData(d), email: d.email ?? null, username: d.username ?? null, passwordHash: await bcrypt.hash(d.password, 12) },
    select: { id: true },
  });
  await audit({ actorId: user.id, action: "user.register", entity: "User", entityId: user.id, meta: { memberType: d.memberType } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
