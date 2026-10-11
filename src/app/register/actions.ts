"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import type { MemberTypeKey } from "@/lib/members";
import { rateLimited } from "@/lib/rate-limit";
import { codeStatus, normalizeCode } from "@/lib/registration";

export type CodeCheck =
  | { ok: true; label: string; memberType: MemberTypeKey; school: { id: string; name: string } | null }
  | { ok: false; error: string };

/** Step 1 of sign-up: is this code usable? Does NOT use it up (that happens when the account is created). */
export async function checkRegistrationCode(raw: string): Promise<CodeCheck> {
  const ip = headers().get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(`code:${ip}`, 15, 15 * 60 * 1000)) return { ok: false, error: "ลองรหัสบ่อยเกินไป กรุณารอสักครู่" };
  const code = normalizeCode(String(raw ?? ""));
  const bad = { ok: false as const, error: "รหัสสมัครไม่ถูกต้อง หมดอายุ หรือถูกใช้ครบแล้ว" }; // same text for every failure
  if (code.length < 6) return bad;
  const rc = await db.registrationCode.findUnique({ where: { code }, include: { school: { select: { id: true, name: true, active: true } } } });
  if (!rc || codeStatus(rc) !== "ok") return bad;
  return { ok: true, label: rc.label, memberType: rc.memberType, school: rc.school?.active ? { id: rc.school.id, name: rc.school.name } : null };
}
