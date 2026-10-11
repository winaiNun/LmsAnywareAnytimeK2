"use client";

import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Icon, Spinner, type IconName } from "@/components/icons";
import Turnstile, { turnstileOn } from "@/components/turnstile";
import PinPad from "@/components/pin-pad";
import { forgetDevice, readDevice, usePhone, type StoredDevice } from "@/lib/use-phone";

type Props = {
  systemName: string;
  areaName: string;
  logoUrl: string | null;
  logoBackdrop: boolean;
  callbackUrl: string | null;
  notice?: string | null;
  devShortcut?: boolean; // DEV-ONLY: one-click test logins (only passed when NODE_ENV=development)
};

// Staff land in the back office (teachers go straight to their slides), members on their own page.
const home = (role?: string) => (role === "ADMIN" || role === "LIBRARIAN" ? "/admin" : role === "TEACHER" ? "/admin/banners" : "/dashboard");

const field =
  "peer h-11 w-full border-0 border-b border-white/70 bg-transparent pl-9 text-white placeholder:text-white/80 focus:border-white focus:outline-none focus:ring-0";
const fieldIcon = "pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-white";

function Field({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Icon name={icon} className={fieldIcon} />
      {children}
    </label>
  );
}

export default function LoginForm({ systemName, areaName, logoUrl, logoBackdrop, callbackUrl, devShortcut, notice }: Props) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const phone = usePhone();
  const [device, setDevice] = useState<StoredDevice | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [pin, setPin] = useState("");
  const [bot, setBot] = useState(""); // Turnstile token (password sign-in only; PIN is capped per phone already)
  const [botKey, setBotKey] = useState(0);
  const [saved, setSaved] = useState(""); // last identifier used on this device
  // PIN sign-in exists only on a phone that was set up (device token on it); everywhere else it is the normal form.
  const method: "pin" | "password" = phone && device && !usePassword ? "pin" : "password";

  useEffect(() => {
    setDevice(readDevice());
    try { setSaved(localStorage.getItem("lms.lastLogin") ?? ""); } catch {}
  }, []);

  // 6th digit entered: sign in straight away.
  useEffect(() => {
    if (method === "pin" && pin.length === 6) formRef.current?.requestSubmit();
  }, [pin, method]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (method === "password" && turnstileOn && !bot) return setError("กรุณารอการตรวจสอบบอตสักครู่ แล้วกดอีกครั้ง");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const remember = String(form.get("remember") === "on");

    const result =
      method === "pin"
        ? await signIn("pin", { token: device?.token, pin, redirect: false })
        : await signIn("credentials", { email, password: String(form.get("password")), remember, turnstile: bot, redirect: false });
    if (result?.error) {
      setBusy(false);
      setBotKey((k) => k + 1); // the token was used up
      if (method === "pin") {
        setPin("");
        setError("PIN ไม่ถูกต้อง หรือเครื่องนี้ถูกยกเลิกแล้ว (ใส่ผิด 5 ครั้งเครื่องจะถูกยกเลิก) — ใช้รหัสผ่านเข้าสู่ระบบได้");
      } else setError("อีเมล/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง");
      return;
    }
    try { if (email) localStorage.setItem("lms.lastLogin", email); } catch {}
    // No explicit destination: staff land in the back office, members on their own page.
    const role = (await getSession())?.user.role;
    window.location.href = callbackUrl ?? (home(role));
  }

  // DEV-ONLY: sign in as the first user of a role without typing anything.
  async function quickLogin(role: string) {
    setError("");
    setBusy(true);
    const result = await signIn("dev-quick-login", { role, redirect: false });
    if (result?.error) {
      setBusy(false);
      setError(`ไม่พบผู้ใช้บทบาท ${role} ในฐานข้อมูล (ลอง npm run db:seed หรือ db:demo)`);
      return;
    }
    window.location.href = callbackUrl ?? (home(role));
  }

  const logoAlt = `โลโก้ ${systemName}`;

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-b from-[#4F8BFF] via-[#2B6BFF] to-[#0052FF] px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#0B2A6F]/30 blur-3xl" aria-hidden />

      <div className="relative w-full max-w-[380px] rounded-sm bg-white/[0.06] px-10 pb-8 pt-10 text-white shadow-[0_0_90px_20px_rgba(0,30,200,0.55)] backdrop-blur-sm">
        {/* Logo: large and transparent by default; a white plate only if the admin turned it on. */}
        <Link href="/" aria-label={`${systemName} — กลับหน้าแรก`} className="mx-auto mb-6 flex w-fit items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
          {logoUrl ? (
            logoBackdrop ? (
              <span className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white/95 p-3 shadow-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={logoAlt} className="max-h-full max-w-full object-contain" />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={logoAlt} className="h-32 w-auto max-w-[260px] object-contain drop-shadow-[0_8px_18px_rgba(0,20,120,0.45)]" />
            )
          ) : (
            <Icon name="book" className="h-24 w-24 text-white drop-shadow-[0_8px_18px_rgba(0,20,120,0.45)]" strokeWidth={1.3} />
          )}
        </Link>

        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">{systemName}</h1>
          {areaName && <p className="mt-1 text-sm text-white/85">{areaName}</p>}
        </div>

        {notice && <p role="status" className="mb-4 rounded bg-white/95 px-3 py-2 text-sm font-medium text-green-700">{notice}</p>}

        <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
          {method === "pin" ? (
            <div>
              <p className="mb-4 text-center text-sm text-white/90">สวัสดี <strong className="text-base">{device?.name || "สมาชิก"}</strong><br />กรอก PIN 6 หลักเพื่อเข้าสู่ระบบ</p>
              <PinPad value={pin} onChange={setPin} disabled={busy} />
              <div className="mt-4 flex flex-wrap justify-center gap-x-5 text-sm">
                <button type="button" onClick={() => { setUsePassword(true); setError(""); }} className="min-h-11 underline underline-offset-4">ใช้รหัสผ่านแทน</button>
                <button type="button" onClick={() => { forgetDevice(); setDevice(null); setError(""); }} className="min-h-11 underline underline-offset-4">ไม่ใช่ฉัน</button>
              </div>
            </div>
          ) : (
            <>
              <Field icon="mail" label="อีเมลหรือชื่อผู้ใช้">
                <input key={saved} name="email" type="text" required defaultValue={saved} placeholder="อีเมลหรือชื่อผู้ใช้" autoComplete="username" autoCapitalize="none" className={field} />
              </Field>
              <Field icon="lock" label="รหัสผ่าน">
                <input name="password" type="password" required minLength={8} placeholder="รหัสผ่าน" autoComplete="current-password" className={field} />
              </Field>
            </>
          )}

          {method === "password" && (
            <label className="flex min-h-9 items-center gap-2 text-sm text-white/90">
              <input type="checkbox" name="remember" className="h-4 w-4 rounded border-white/70 bg-transparent text-[#0B2A6F] focus:ring-white" />
              จดจำฉันไว้ 30 วัน
            </label>
          )}

          {method === "password" && <Turnstile onToken={setBot} resetKey={botKey} />}

          {error && (
            <p role="alert" className="rounded bg-white/95 px-3 py-2 text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          {method === "password" && (
          <button
              disabled={busy}
              className="group mt-2 flex min-h-12 w-full items-center justify-center gap-2 bg-[#0B2A6F] text-sm font-semibold tracking-wide text-white shadow-lg transition hover:bg-[#071d52] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-70"
            >
              {busy ? (
                <>
                  <Spinner className="h-5 w-5" />
                  กำลังตรวจสอบ...
                </>
              ) : (
                <>
                  <Icon name="login" className="h-5 w-5" />
                  เข้าสู่ระบบ
                  <Icon name="arrowRight" className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          )}
        </form>

        <p className="mx-auto mt-4 max-w-[19rem] text-center text-xs leading-relaxed text-white/80">ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบหรือครูผู้ดูแลของโรงเรียนเพื่อขอรหัสผ่านใหม่</p>
        <Link href="/register" className="mx-auto mt-3 flex min-h-11 w-fit items-center gap-2 text-sm text-white underline underline-offset-4">
          <Icon name="userPlus" className="h-4 w-4" />
          ยังไม่มีบัญชี? สมัครสมาชิก
        </Link>
        {devShortcut && (
          <div className="mt-4 rounded-lg border border-dashed border-white/60 p-3">
            <p className="mb-2 flex items-center gap-2 text-xs text-white/90">
              <Icon name="shield" className="h-4 w-4" />
              ทางลัดสำหรับทดสอบ (มีเฉพาะตอน npm run dev)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["ADMIN", "แอดมิน"],
                ["LIBRARIAN", "บรรณารักษ์"],
                ["TEACHER", "ผู้สร้าง"],
                ["STUDENT", "สมาชิก"],
              ].map(([role, label]) => (
                <button key={role} type="button" disabled={busy} onClick={() => quickLogin(role)} className="min-h-11 rounded bg-white/90 text-sm font-semibold text-[#0B2A6F] hover:bg-white disabled:opacity-60">
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Link href="/" className="mx-auto flex min-h-11 w-fit items-center gap-2 text-sm text-white/85 hover:text-white">
          <Icon name="arrowLeft" className="h-4 w-4" />
          กลับหน้าหลัก
        </Link>
      </div>
    </main>
  );
}
