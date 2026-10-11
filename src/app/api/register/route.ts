import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { emailField, profileData, profileSchema, usernameField } from "@/lib/members";
import { clientIp } from "@/lib/rate-limit";
import { rateLimitedDb } from "@/lib/rate-limit-db";
import { verifyTurnstile } from "@/lib/turnstile";
import { codeStatus, normalizeCode, redeemCode } from "@/lib/registration";
import { getSiteInfo } from "@/lib/site";

const schema = z
  .object({
    email: emailField.optional().or(z.literal("").transform(() => undefined)),
    username: usernameField.optional().or(z.literal("").transform(() => undefined)),
    password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัว").max(100),
    consent: z.literal(true, { error: "กรุณายอมรับการเก็บและใช้ข้อมูลส่วนบุคคล" }),
  })
  .and(profileSchema);

const BAD_CODE = "รหัสสมัครไม่ถูกต้อง หมดอายุ หรือถูกใช้ครบแล้ว"; // one message for every failure: no hints for guessers

export async function POST(req: Request) {
  if (await rateLimitedDb(`register:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "ลองสมัครบ่อยเกินไป กรุณารอสักครู่" }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  if (!(await verifyTurnstile(body.turnstile, clientIp(req)))) return NextResponse.json({ error: "ตรวจสอบบอตไม่ผ่าน กรุณาลองใหม่อีกครั้ง" }, { status: 400 });

  // 1) The code first: it decides the member type and (if set) the school; the browser cannot override them.
  const site = await getSiteInfo();
  const code = typeof body.code === "string" ? normalizeCode(body.code) : "";
  if (site.requireRegistrationCode && !code) return NextResponse.json({ error: "กรุณากรอกรหัสสมัคร" }, { status: 400 });
  let rc = null;
  if (code) {
    if (await rateLimitedDb(`code:${clientIp(req)}`, 15, 15 * 60 * 1000)) return NextResponse.json({ error: "ลองรหัสบ่อยเกินไป กรุณารอสักครู่" }, { status: 429 });
    rc = await db.registrationCode.findUnique({ where: { code } });
    if (!rc || codeStatus(rc) !== "ok") return NextResponse.json({ error: BAD_CODE }, { status: 400 });
  }

  // 2) Then the form itself.
  const parsed = schema.safeParse(rc ? { ...body, memberType: rc.memberType, schoolId: rc.schoolId ?? body.schoolId } : body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const d = parsed.data;
  if (!d.email && !d.username) return NextResponse.json({ error: "กรุณากรอกอีเมลหรือชื่อผู้ใช้อย่างน้อยหนึ่งอย่าง" }, { status: 400 });

  if (d.email && (await db.user.findUnique({ where: { email: d.email } }))) return NextResponse.json({ error: "อีเมลนี้ถูกใช้แล้ว" }, { status: 409 });
  if (d.username && (await db.user.findUnique({ where: { username: d.username } }))) return NextResponse.json({ error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" }, { status: 409 });
  if (d.schoolId && !(await db.school.findFirst({ where: { id: d.schoolId, active: true }, select: { id: true } }))) {
    return NextResponse.json({ error: "ไม่พบโรงเรียนที่เลือก" }, { status: 400 });
  }

  // 3) Create the account and use up one seat of the code in ONE transaction: the seat is only spent when the account exists.
  // Self-registration is always STUDENT (the permission role); staff roles are granted by an admin.
  const passwordHash = await bcrypt.hash(d.password, 12); // slow on purpose: keep it out of the transaction
  try {
    const user = await db.$transaction(async (tx) => {
      if (rc && !(await redeemCode(tx, rc.id))) throw new Error("code");
      return tx.user.create({
        data: { ...profileData(d), email: d.email ?? null, username: d.username ?? null, passwordHash, registrationCodeId: rc?.id ?? null },
        select: { id: true },
      });
    });
    await audit({ actorId: user.id, action: "user.register", entity: "User", entityId: user.id, meta: { memberType: d.memberType, code: rc ? rc.label : null } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "code") return NextResponse.json({ error: BAD_CODE }, { status: 400 });
    throw e;
  }
}
