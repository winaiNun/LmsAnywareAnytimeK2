"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRef, useState } from "react";
import { Icon, Spinner, type IconName } from "@/components/icons";
import SchoolPicker, { type SchoolOption } from "@/components/school-picker";
import { MEMBER_TYPES, MEMBER_TYPE_LABEL, PREFIXES, needsSchool, type MemberTypeKey } from "@/lib/members";

type Props = { systemName: string; areaName: string; logoUrl: string | null; schools: SchoolOption[] };

const TYPE_INFO: Record<MemberTypeKey, { icon: IconName; hint: string }> = {
  STUDENT: { icon: "book", hint: "เรียนรู้และอ่านสื่อ" },
  TEACHER: { icon: "school", hint: "ครูในโรงเรียน" },
  SUPERVISOR: { icon: "shield", hint: "ศึกษานิเทศก์" },
  GENERAL: { icon: "user", hint: "ผู้สนใจทั่วไป" },
};
const STEPS = ["ประเภท", "ข้อมูล", "บัญชี"];

const label = "block text-sm font-medium text-white/90";
const input =
  "mt-1.5 min-h-12 w-full rounded-xl border border-white/30 bg-white/10 px-4 text-white placeholder:text-white/55 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/40 [&>option]:text-neutral-900";

export default function RegisterForm({ systemName, areaName, logoUrl, schools }: Props) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<MemberTypeKey>("STUDENT");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const panels = useRef<(HTMLDivElement | null)[]>([]);

  /** Native validation of just the visible step (other steps stay mounted but hidden to keep their values). */
  function stepValid(i: number) {
    const els = panels.current[i]?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select");
    for (const el of els ?? []) {
      if (el.checkValidity()) continue;
      if (el.getAttribute("aria-hidden")) setError("กรุณาเลือกโรงเรียน");
      else el.reportValidity();
      return false;
    }
    return true;
  }

  function go(to: number) {
    setError("");
    if (to > step && !stepValid(step)) return;
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < 2) return go(step + 1);
    if (!stepValid(2)) return;
    const f = new FormData(e.currentTarget);
    if (!f.get("email") && !f.get("username")) return setError("กรุณากรอกอีเมลหรือชื่อผู้ใช้อย่างน้อยหนึ่งอย่าง");
    if (f.get("password") !== f.get("confirm")) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setError("");
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

  const panel = (i: number) => `${step === i ? "block" : "hidden"} space-y-5`;

  return (
    <main
      className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-b from-[#4F8BFF] via-[#2B6BFF] to-[#0052FF] px-4 pb-10 pt-8"
      style={{ paddingTop: "max(2rem, env(safe-area-inset-top))", paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#0B2A6F]/30 blur-3xl" aria-hidden />

      <div className="relative mx-auto w-full max-w-lg">
        <Link href="/" aria-label={`${systemName} — กลับหน้าแรก`} className="mx-auto mb-5 flex w-fit items-center justify-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`โลโก้ ${systemName}`} className="h-20 w-auto max-w-[200px] object-contain drop-shadow-[0_8px_18px_rgba(0,20,120,0.45)]" />
          ) : (
            <Icon name="book" className="h-16 w-16 text-white drop-shadow-[0_8px_18px_rgba(0,20,120,0.45)]" strokeWidth={1.3} />
          )}
        </Link>
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-bold tracking-tight">สมัครสมาชิก</h1>
          <p className="mt-1 text-sm text-white/85">{areaName || systemName}</p>
        </div>

        {/* progress */}
        <ol className="mx-auto mb-6 flex max-w-xs items-center" aria-label="ขั้นตอนการสมัคร">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center last:flex-none" aria-current={step === i ? "step" : undefined}>
              <span className="flex flex-col items-center gap-1">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${i <= step ? "bg-white text-[#0B2A6F] shadow-lg" : "bg-white/20 text-white"}`}>{i < step ? "✓" : i + 1}</span>
                <span className={`text-xs ${i === step ? "font-semibold text-white" : "text-white/70"}`}>{s}</span>
              </span>
              {i < STEPS.length - 1 && <span className={`mx-2 mb-5 h-0.5 flex-1 rounded ${i < step ? "bg-white" : "bg-white/25"}`} />}
            </li>
          ))}
        </ol>

        <form onSubmit={onSubmit} noValidate className="rounded-3xl border border-white/20 bg-white/[0.08] p-5 text-white shadow-[0_20px_80px_rgba(0,20,120,0.45)] backdrop-blur-md sm:p-8">
          {/* step 1 — member type */}
          <div ref={(el) => { panels.current[0] = el; }} className={panel(0)}>
            <fieldset>
              <legend className="mb-3 text-lg font-semibold">คุณคือใคร?</legend>
              <div className="grid grid-cols-2 gap-3">
                {MEMBER_TYPES.map((t) => (
                  <label key={t} className={`relative flex min-h-[7.5rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition focus-within:ring-2 focus-within:ring-white ${type === t ? "border-white bg-white text-[#0B2A6F] shadow-xl" : "border-white/30 bg-white/5 hover:bg-white/15"}`}>
                    <input type="radio" name="memberType" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                    <Icon name={TYPE_INFO[t].icon} className="h-8 w-8" strokeWidth={1.5} />
                    <span className="font-semibold">{MEMBER_TYPE_LABEL[t]}</span>
                    <span className={`text-xs ${type === t ? "text-[#0B2A6F]/70" : "text-white/70"}`}>{TYPE_INFO[t].hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {/* step 2 — profile */}
          <div ref={(el) => { panels.current[1] = el; }} className={panel(1)}>
            <h2 className="text-lg font-semibold">ข้อมูลของคุณ</h2>
            <div className="grid grid-cols-3 gap-3">
              <label className={label}>คำนำหน้า
                <select name="prefix" defaultValue="" className={input}>
                  <option value="">-</option>
                  {PREFIXES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label className={`${label} col-span-2`}>ชื่อ *<input name="firstName" required maxLength={60} autoComplete="given-name" className={input} /></label>
            </div>
            <label className={label}>นามสกุล *<input name="lastName" required maxLength={60} autoComplete="family-name" className={input} /></label>

            {needsSchool(type) && (
              <div className={label}>
                <span>โรงเรียน *</span>
                <div className="mt-1.5"><SchoolPicker schools={schools} required tone="dark" /></div>
              </div>
            )}
            {type === "STUDENT" && <label className={label}>ชั้น (เช่น ป.5, ม.2)<input name="gradeLevel" maxLength={40} className={input} /></label>}
            {!needsSchool(type) && <label className={label}>หน่วยงาน/สังกัด{type === "SUPERVISOR" ? " *" : ""}<input name="organization" required={type === "SUPERVISOR"} maxLength={120} className={input} /></label>}
            {type !== "STUDENT" && <label className={label}>ตำแหน่ง/วิทยฐานะ<input name="position" maxLength={120} className={input} /></label>}
            <label className={label}>เบอร์โทร<input name="phone" type="tel" inputMode="tel" maxLength={20} autoComplete="tel" className={input} /></label>
          </div>

          {/* step 3 — account */}
          <div ref={(el) => { panels.current[2] = el; }} className={panel(2)}>
            <h2 className="text-lg font-semibold">ตั้งค่าบัญชี</h2>
            <label className={label}>อีเมล<input name="email" type="email" maxLength={120} autoComplete="email" autoCapitalize="none" className={input} /></label>
            <label className={label}>ชื่อผู้ใช้ <span className="font-normal text-white/70">(ถ้าไม่มีอีเมล)</span><input name="username" maxLength={30} autoComplete="username" autoCapitalize="none" placeholder="a-z 0-9 . _ -" className={input} /></label>
            <p className="-mt-2 text-xs text-white/75">กรอกอย่างน้อยหนึ่งอย่าง ใช้สำหรับเข้าสู่ระบบ</p>
            <label className={label}>รหัสผ่าน * <span className="font-normal text-white/70">(อย่างน้อย 8 ตัว)</span><input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
            <label className={label}>ยืนยันรหัสผ่าน *<input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
            <label className="flex items-start gap-3 text-sm text-white/90">
              <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/60 bg-transparent text-[#0B2A6F] focus:ring-white" />
              <span>ยินยอมให้เก็บและใช้ข้อมูลเพื่อการเรียนรู้ การออกเกียรติบัตร และรายงานสถิติของเครือข่าย (ไม่เก็บเลขบัตรประชาชนและที่อยู่)</span>
            </label>
          </div>

          {error && <p role="alert" className="mt-5 rounded-xl bg-white/95 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

          <div className="mt-6 flex gap-3">
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/50 px-5 font-semibold">
                <Icon name="arrowLeft" className="h-4 w-4" /> ย้อนกลับ
              </button>
            )}
            <button disabled={busy} className="group flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B2A6F] font-semibold text-white shadow-lg transition hover:bg-[#071d52] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-70">
              {busy ? <><Spinner className="h-5 w-5" /> กำลังสมัคร...</> : step < 2 ? <>ถัดไป <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-1" /></> : <><Icon name="userPlus" className="h-5 w-5" /> สมัครสมาชิก</>}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-white/90">
          มีบัญชีแล้ว? <Link href="/login" className="font-semibold underline underline-offset-4">เข้าสู่ระบบ</Link>
        </p>
        <Link href="/" className="mx-auto mt-1 flex min-h-11 w-fit items-center gap-2 text-sm text-white/85 hover:text-white">
          <Icon name="arrowLeft" className="h-4 w-4" /> กลับหน้าหลัก
        </Link>
      </div>
    </main>
  );
}
