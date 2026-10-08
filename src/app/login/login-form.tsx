"use client";

import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { useState } from "react";

type Props = { systemName: string; areaName: string; logoUrl: string | null; callbackUrl: string | null };

const field =
  "peer h-11 w-full border-0 border-b border-white/70 bg-transparent pl-9 text-white placeholder:text-white/80 focus:border-white focus:outline-none focus:ring-0";
const icon = "pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-white";

export default function LoginForm({ systemName, areaName, logoUrl, callbackUrl }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    if (mode === "register") {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email, password }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "สมัครสมาชิกไม่สำเร็จ");
        setBusy(false);
        return;
      }
    }

    const result = await signIn("credentials", { email, password, remember: String(form.get("remember") === "on"), redirect: false });
    setBusy(false);
    if (result?.error) setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    else {
      // No explicit destination: staff land in the back office, members on their own page.
      const role = (await getSession())?.user.role;
      window.location.href = callbackUrl ?? (role === "ADMIN" || role === "LIBRARIAN" ? "/admin" : "/dashboard");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#4F8BFF] via-[#2B6BFF] to-[#0052FF] px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#0B2A6F]/30 blur-3xl" aria-hidden />

      <Link
        href="/"
        className="absolute left-4 top-4 z-10 flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 18l-6-6 6-6" />
        </svg>
        กลับหน้าหลัก
      </Link>

      <div className="relative w-full max-w-[380px] rounded-sm bg-white/[0.06] px-10 pb-10 pt-12 text-white shadow-[0_0_90px_20px_rgba(0,30,200,0.55)] backdrop-blur-sm">
        <Link href="/" aria-label={`${systemName} — กลับหน้าแรก`} className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-14 w-14 object-contain" />
          ) : (
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#0052FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
              <path d="M8 7h7" />
            </svg>
          )}
        </Link>

        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">{systemName}</h1>
          {areaName && <p className="mt-1 text-sm text-white/85">{areaName}</p>}
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {mode === "register" && (
            <label className="relative block">
              <span className="sr-only">ชื่อ-นามสกุล</span>
              <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
              <input name="name" required maxLength={100} placeholder="ชื่อ-นามสกุล" autoComplete="name" className={field} />
            </label>
          )}
          <label className="relative block">
            <span className="sr-only">อีเมล</span>
            <svg className={icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M2 5h20v14H2zm2 2v.5l8 5.5 8-5.5V7zm16 3-8 5.5L4 10v7h16z" fillRule="evenodd" /></svg>
            <input name="email" type="email" required placeholder="อีเมล" autoComplete="email" className={field} />
          </label>
          <label className="relative block">
            <span className="sr-only">รหัสผ่าน</span>
            <svg className={icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z" /></svg>
            <input name="password" type="password" required minLength={8} placeholder={mode === "register" ? "รหัสผ่าน (อย่างน้อย 8 ตัว)" : "รหัสผ่าน"} autoComplete={mode === "login" ? "current-password" : "new-password"} className={field} />
          </label>

          {mode === "login" && (
            <label className="flex min-h-9 items-center gap-2 text-sm text-white/90">
              <input type="checkbox" name="remember" className="h-4 w-4 rounded border-white/70 bg-transparent text-[#0B2A6F] focus:ring-white" />
              จดจำฉันไว้ 30 วัน
            </label>
          )}

          {error && (
            <p role="alert" className="rounded bg-white/95 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            disabled={busy}
            className="mt-2 min-h-12 w-full bg-[#0B2A6F] text-sm font-semibold tracking-wide text-white shadow-lg transition hover:bg-[#071d52] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
          >
            {busy ? "กรุณารอสักครู่..." : mode === "login" ? "เข้าสู่ระบบ" : "สมัครและเข้าสู่ระบบ"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
          className="mx-auto mt-6 block min-h-11 text-sm text-white underline underline-offset-4"
        >
          {mode === "login" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
        </button>
        <Link href="/" className="mx-auto block min-h-11 pt-2 text-center text-sm text-white/85 hover:text-white">
          ← กลับหน้าหลัก
        </Link>
      </div>
    </main>
  );
}
