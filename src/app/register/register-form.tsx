"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { MEMBER_TYPES, MEMBER_TYPE_LABEL, PREFIXES, needsSchool, type MemberTypeKey } from "@/lib/members";

type School = { id: string; name: string; district: string };

const input = "mt-1 min-h-11 w-full rounded border border-neutral-300 px-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export default function RegisterForm({ systemName, schools }: { systemName: string; schools: School[] }) {
  const [type, setType] = useState<MemberTypeKey>("STUDENT");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setBusy(true);
    const body = { ...Object.fromEntries(f), memberType: type, consent: f.get("consent") === "on" };
    const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "สมัครสมาชิกไม่สำเร็จ");
      return setBusy(false);
    }
    const login = String(f.get("email") || f.get("username"));
    const r = await signIn("credentials", { email: login, password: String(f.get("password")), redirect: false });
    window.location.href = r?.error ? "/login" : "/dashboard";
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold">สมัครสมาชิก</h1>
      <p className="text-sm text-neutral-500">{systemName}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-xl bg-white p-5 shadow-sm">
        <fieldset>
          <legend className="text-sm font-medium">ฉันเป็น</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MEMBER_TYPES.map((t) => (
              <label key={t} className={`flex min-h-11 cursor-pointer items-center justify-center rounded border px-2 text-sm font-medium ${type === t ? "border-brand bg-brand text-white" : "border-neutral-300"}`}>
                <input type="radio" name="memberType" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                {MEMBER_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">คำนำหน้า
            <select name="prefix" className={input} defaultValue="">
              <option value="">-</option>
              {PREFIXES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="block text-sm">ชื่อ *<input name="firstName" required maxLength={60} autoComplete="given-name" className={input} /></label>
          <label className="block text-sm">นามสกุล *<input name="lastName" required maxLength={60} autoComplete="family-name" className={input} /></label>
        </div>

        {needsSchool(type) && (
          <label className="block text-sm">โรงเรียน *
            <select name="schoolId" required defaultValue="" className={input}>
              <option value="" disabled>— เลือกโรงเรียน —</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name} (อ.{s.district})</option>)}
            </select>
          </label>
        )}
        {type === "STUDENT" && <label className="block text-sm">ชั้น (เช่น ป.5, ม.2)<input name="gradeLevel" maxLength={40} className={input} /></label>}
        {!needsSchool(type) && (
          <label className="block text-sm">หน่วยงาน/สังกัด{type === "SUPERVISOR" ? " *" : ""}<input name="organization" required={type === "SUPERVISOR"} maxLength={120} className={input} /></label>
        )}
        {type !== "STUDENT" && <label className="block text-sm">ตำแหน่ง/วิทยฐานะ<input name="position" maxLength={120} className={input} /></label>}
        <label className="block text-sm">เบอร์โทร<input name="phone" type="tel" maxLength={20} autoComplete="tel" className={input} /></label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">อีเมล<input name="email" type="email" maxLength={120} autoComplete="email" className={input} /></label>
          <label className="block text-sm">ชื่อผู้ใช้ (ถ้าไม่มีอีเมล)<input name="username" maxLength={30} autoComplete="username" className={input} placeholder="a-z 0-9 . _ -" /></label>
        </div>
        <p className="-mt-3 text-xs text-neutral-500">กรอกอีเมลหรือชื่อผู้ใช้อย่างน้อยหนึ่งอย่าง ใช้เข้าสู่ระบบ</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">รหัสผ่าน * (อย่างน้อย 8 ตัว)<input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
          <label className="block text-sm">ยืนยันรหัสผ่าน *<input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" required className="mt-1 h-4 w-4" />
          <span>ยินยอมให้เก็บและใช้ข้อมูลข้างต้นเพื่อการเรียนรู้ การออกเกียรติบัตร และรายงานสถิติของเครือข่าย (ไม่เก็บเลขบัตรประชาชนและที่อยู่)</span>
        </label>

        {error && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <button disabled={busy} className="min-h-12 w-full rounded bg-brand font-semibold text-white disabled:opacity-60">{busy ? "กำลังสมัคร..." : "สมัครสมาชิก"}</button>
        <p className="text-center text-sm">มีบัญชีแล้ว? <Link href="/login" className="text-brand underline">เข้าสู่ระบบ</Link></p>
      </form>
    </main>
  );
}
