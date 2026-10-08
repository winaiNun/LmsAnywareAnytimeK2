"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { changePassword, type PasswordState } from "./actions";

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

function Submit() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-12 w-full rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}</button>;
}

export default function PasswordForm({ forced }: { forced: boolean }) {
  const [state, action] = useFormState<PasswordState, FormData>(changePassword, undefined);

  // The session still carries the old "must change" flag, so sign out and sign in again with the new password.
  useEffect(() => {
    if (state?.done) {
      const t = setTimeout(() => signOut({ callbackUrl: "/login?changed=1" }), 1200);
      return () => clearTimeout(t);
    }
  }, [state?.done]);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      {forced && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">คุณใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านของคุณเองก่อนใช้งานต่อ</p>}
      <label className="block space-y-1"><span className="text-sm font-medium">รหัสผ่านปัจจุบัน{forced && " (รหัสชั่วคราวที่ได้รับ)"}</span><input name="current" type="password" required autoComplete="current-password" className={input} /></label>
      <label className="block space-y-1"><span className="text-sm font-medium">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</span><input name="next" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
      <label className="block space-y-1"><span className="text-sm font-medium">ยืนยันรหัสผ่านใหม่</span><input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.done && <p role="status" className="text-sm text-green-700">เปลี่ยนรหัสผ่านแล้ว กำลังพาไปเข้าสู่ระบบอีกครั้ง…</p>}
      <Submit />
      {!forced && <a href="/dashboard" className="block text-center text-sm text-brand">ยกเลิก</a>}
    </form>
  );
}
