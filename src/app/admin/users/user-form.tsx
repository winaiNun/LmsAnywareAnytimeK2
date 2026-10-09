"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import ProfileFields, { type ProfileValues, type SchoolOption } from "@/components/profile-fields";
import { createUser, decideCreator, deleteUser, resetPassword, saveUser, type UserFormState } from "./actions";

export type UserValues = {
  id?: string;
  email: string;
  username: string;
  role: string;
  active: boolean;
  isSelf: boolean;
  creatorStatus: string;
  creatorReason: string;
  profile: ProfileValues;
};

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";
const ROLES: [string, string][] = [["STUDENT", "สมาชิก (STUDENT)"], ["TEACHER", "ผู้สร้างคอร์ส (TEACHER)"], ["LIBRARIAN", "บรรณารักษ์ (LIBRARIAN)"], ["ADMIN", "ผู้ดูแลระบบ (ADMIN)"]];

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : children}</button>;
}

export default function UserForm({ user, schools }: { user: UserValues; schools: SchoolOption[] }) {
  const router = useRouter();
  const isNew = !user.id;
  const [state, action] = useFormState<UserFormState, FormData>(isNew ? createUser : saveUser.bind(null, user.id!), undefined);
  const [pw, setPw] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  if (isNew && state?.saved) {
    return (
      <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
        <p className="font-semibold text-green-700">สร้างผู้ใช้แล้ว</p>
        <p className="text-sm">รหัสผ่านชั่วคราว (แสดงครั้งเดียว — ผู้ใช้ต้องเปลี่ยนตอนเข้าสู่ระบบครั้งแรก):</p>
        <code className="block select-all rounded bg-neutral-100 p-3 text-lg">{state.tempPassword}</code>
        <button onClick={() => router.push(`/admin/users/${state.id}`)} className="min-h-11 rounded-lg border px-5">ไปหน้าผู้ใช้</button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-sm font-medium">อีเมล</span><input name="email" type="email" maxLength={120} defaultValue={user.email} className={input} /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">ชื่อผู้ใช้</span><input name="username" maxLength={30} defaultValue={user.username} className={input} placeholder="a-z 0-9 . _ -" /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">สิทธิ์ในระบบ</span>
            <select name="role" defaultValue={user.role} className={input}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          {isNew && <label className="block space-y-1"><span className="text-sm font-medium">รหัสผ่าน (เว้นว่าง = สร้างให้)</span><input name="password" minLength={8} autoComplete="off" className={input} /></label>}
        </div>
        <ProfileFields values={user.profile} schools={schools} />
        {!isNew && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={user.active} className="h-4 w-4" /> เปิดใช้งานบัญชี</label>}
        {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        {state?.saved && !isNew && <p role="status" className="text-sm text-green-700">บันทึกแล้ว</p>}
        <Submit>{isNew ? "สร้างผู้ใช้" : "บันทึก"}</Submit>
      </form>

      {!isNew && (
        <aside className="space-y-4">
          {user.creatorStatus === "PENDING" && (
            <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold">คำขอเป็นผู้สร้างคอร์ส</h2>
              <p className="text-sm">{user.creatorReason}</p>
              <div className="flex gap-2">
                <button disabled={pending} onClick={() => start(async () => { const r = await decideCreator(user.id!, true); setMsg(r.error ?? ""); router.refresh(); })} className="min-h-11 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white">อนุมัติ</button>
                <button disabled={pending} onClick={() => start(async () => { const r = await decideCreator(user.id!, false); setMsg(r.error ?? ""); router.refresh(); })} className="min-h-11 rounded-lg border px-4 text-sm">ไม่อนุมัติ</button>
              </div>
            </section>
          )}
          <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">รหัสผ่าน</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const typed = String(new FormData(e.currentTarget).get("typed") ?? "");
                start(async () => { const r = await resetPassword(user.id!, typed || undefined); setMsg(r.error ?? ""); setPw(r.password ?? null); });
              }}
              className="space-y-2"
            >
              <input name="typed" minLength={8} placeholder="ตั้งเอง (เว้นว่าง = สุ่มให้)" autoComplete="off" className={input} />
              <button disabled={pending} className="min-h-11 rounded-lg border px-4 text-sm">ตั้งรหัสผ่านใหม่</button>
            </form>
            {pw && (
              <div className="rounded bg-neutral-100 p-3 text-sm">
                รหัสผ่านใหม่ (แสดงครั้งเดียว): <code className="block select-all text-lg">{pw}</code>
              </div>
            )}
          </section>
          <section className="space-y-2 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">ลบผู้ใช้</h2>
            <p className="text-xs text-neutral-500">ลบได้เฉพาะบัญชีที่ไม่มีประวัติยืม/เรียน/สไลด์ มิฉะนั้นให้ปิดใช้งาน</p>
            <button
              disabled={pending || user.isSelf}
              onClick={() => { if (confirm("ลบผู้ใช้นี้ถาวร?")) start(async () => { const r = await deleteUser(user.id!); if (r.error) setMsg(r.error); else router.push("/admin/users"); }); }}
              className="min-h-11 rounded-lg border border-red-200 px-5 text-red-600 disabled:opacity-40"
            >
              ลบผู้ใช้
            </button>
          </section>
          {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
        </aside>
      )}
    </div>
  );
}
