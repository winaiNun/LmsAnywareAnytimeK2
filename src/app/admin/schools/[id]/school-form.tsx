"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Spinner } from "@/components/icons";
import { deleteSchool, issueSchoolPassword, refreshCards, saveSchool, type SchoolFormState } from "../actions";

type School = { id: string; code: string; name: string; district: string; center: string; email: string; siteUrl: string; cardSourceUrl: string; active: boolean; cardUrl: string | null; cardStatus: string; cardError: string | null };
type Account = { email: string; mustChange: boolean; active: boolean } | null;

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

function Submit() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : "บันทึก"}</button>;
}

export default function SchoolForm({ school, account }: { school: School; account: Account }) {
  const router = useRouter();
  const [state, action] = useFormState<SchoolFormState, FormData>(saveSchool.bind(null, school.id), undefined);
  const [pw, setPw] = useState<{ email: string; password: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2"><span className="text-sm font-medium">ชื่อโรงเรียน *</span><input name="name" required maxLength={150} defaultValue={school.name} className={input} /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">อำเภอ *</span><input name="district" required maxLength={60} defaultValue={school.district} className={input} /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">ศูนย์เครือข่าย *</span><input name="center" required maxLength={60} defaultValue={school.center} className={input} /></label>
          <label className="block space-y-1 sm:col-span-2"><span className="text-sm font-medium">อีเมลของโรงเรียน (ใช้เข้าสู่ระบบ)</span><input name="email" type="email" defaultValue={school.email} className={input} /></label>
          <label className="block space-y-1 sm:col-span-2"><span className="text-sm font-medium">ลิงก์ Anywhere Anytime ของโรงเรียน</span><input name="siteUrl" defaultValue={school.siteUrl} placeholder="https://sites.google.com/…" className={input} /></label>
          <label className="block space-y-1 sm:col-span-2"><span className="text-sm font-medium">ลิงก์การ์ด (ไฟล์ภาพหรือ PDF ใน Google Drive ที่แชร์เป็น “ทุกคนที่มีลิงก์”)</span><input name="cardSourceUrl" defaultValue={school.cardSourceUrl} placeholder="https://drive.google.com/file/d/…/view" className={input} /></label>
        </div>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={school.active} className="h-4 w-4" /> แสดงในหน้าเว็บ</label>
        {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        {state?.saved && <p role="status" className="text-sm text-green-700">บันทึกแล้ว (ถ้าเปลี่ยนลิงก์การ์ด กด “ดึงภาพการ์ดใหม่” ด้านขวา)</p>}
        <div className="flex flex-wrap gap-3"><Submit />
          <button type="button" disabled={pending} onClick={() => { if (confirm(`ลบ ${school.name} ออกจากทำเนียบ? (บัญชีผู้ใช้ไม่ถูกลบ)`)) start(async () => { await deleteSchool(school.id); router.push("/admin/schools"); }); }} className="min-h-11 rounded-lg border border-red-200 px-5 text-red-600">ลบโรงเรียน</button>
        </div>
      </form>

      <aside className="space-y-4">
        <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">ภาพการ์ด</h2>
          <div className="aspect-video overflow-hidden rounded-lg bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {school.cardUrl ? <img src={school.cardUrl} alt={`การ์ดของ${school.name}`} className="h-full w-full object-contain" /> : <p className="flex h-full items-center justify-center p-4 text-center text-sm text-neutral-500">ยังไม่มีภาพการ์ด</p>}
          </div>
          {school.cardError && <p className="text-xs text-red-600">ครั้งล่าสุด: {school.cardError}</p>}
          <button type="button" disabled={pending || !school.cardSourceUrl} onClick={() => start(async () => { const r = await refreshCards([school.id]); setMsg(r[0]?.ok ? "ดึงภาพการ์ดสำเร็จ" : `ไม่สำเร็จ: ${r[0]?.error ?? ""}`); router.refresh(); })} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand bg-brand-soft px-4 text-sm font-semibold text-brand disabled:opacity-50">
            {pending && <Spinner className="h-4 w-4" />}ดึงภาพการ์ดใหม่จาก Drive
          </button>
          {msg && <p role="status" className="text-sm">{msg}</p>}
        </section>

        <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">บัญชีผู้ใช้ของโรงเรียน</h2>
          {account ? (
            <p className="text-sm text-neutral-600">{account.email} · {account.active ? (account.mustChange ? "รอเปลี่ยนรหัสผ่านครั้งแรก" : "ใช้งานแล้ว") : "ถูกปิดใช้งาน"}</p>
          ) : (
            <p className="text-sm text-neutral-600">ยังไม่มีบัญชี{school.email ? " — กดด้านล่างเพื่อสร้างจากอีเมลนี้" : " — เพิ่มอีเมลก่อน"}</p>
          )}
          <button type="button" disabled={pending || !school.email} onClick={() => { if (!confirm("ออกรหัสผ่านชั่วคราวใหม่? รหัสเดิมจะใช้ไม่ได้ทันที")) return; start(async () => { const r = await issueSchoolPassword(school.id); if (r.ok) { setPw(r); router.refresh(); } else setMsg(r.error); }); }} className="min-h-11 w-full rounded-lg border border-neutral-300 px-4 text-sm hover:bg-neutral-50 disabled:opacity-50">
            {account ? "ออกรหัสผ่านชั่วคราวใหม่" : "สร้างบัญชีและออกรหัสผ่านชั่วคราว"}
          </button>
          {pw && (
            <div role="status" className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <p>ชื่อผู้ใช้: <strong>{pw.email}</strong></p>
              <p>รหัสผ่านชั่วคราว: <strong className="select-all font-mono text-base">{pw.password}</strong></p>
              <p className="text-xs text-amber-800">แสดงครั้งเดียว — ส่งให้โรงเรียนทันที ระบบจะบังคับให้ตั้งรหัสใหม่ตอนเข้าครั้งแรก</p>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
