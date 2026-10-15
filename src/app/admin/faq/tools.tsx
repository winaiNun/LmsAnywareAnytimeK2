"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addStarterFaqs, clearHandledUnanswered, deleteUnanswered, setFaqEnabled, setUnansweredStatus } from "./actions";

const btn = "min-h-9 rounded-lg border border-neutral-300 px-3 text-xs disabled:opacity-40";

/** The chat's site-wide switch. */
export function EnabledSwitch({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" checked={enabled} disabled={pending} onChange={(e) => start(async () => { await setFaqEnabled(e.target.checked); })} className="h-5 w-5" />
      <span><strong>เปิดแชตถามตอบบนหน้าเว็บ</strong> <span className="text-neutral-500">(ปุ่มจะแสดงเมื่อมีคำถามที่ “แสดง” อย่างน้อย 1 ข้อ)</span></span>
    </label>
  );
}

/** Adds the starter questions as hidden drafts. */
export function StarterButton() {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => {
        const r = await addStarterFaqs();
        setMsg(r.error ?? (r.added ? `เพิ่ม ${r.added} ข้อ (ซ่อนไว้เป็นฉบับร่าง — ตรวจแล้วกด “แสดง”)` : "มีคำถามตัวอย่างครบแล้ว"));
      })} className="min-h-11 rounded-lg border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-soft disabled:opacity-50">
        {pending ? "กำลังเพิ่ม..." : "ใส่คำถามตัวอย่างเริ่มต้น (ฉบับร่าง)"}
      </button>
      {msg && <span role="status" className="text-xs text-neutral-600">{msg}</span>}
    </div>
  );
}

/** Actions for one unanswered question. */
export function UnansweredActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status !== "ANSWERED" && <Link href={`/admin/faq?from=${id}`} className={`${btn} flex items-center border-brand text-brand`}>สร้างคำตอบ</Link>}
      {status === "DISMISSED" ? (
        <button type="button" disabled={pending} onClick={() => start(async () => { await setUnansweredStatus(id, "OPEN"); })} className={btn}>เปิดอีกครั้ง</button>
      ) : (
        <button type="button" disabled={pending} onClick={() => start(async () => { await setUnansweredStatus(id, "DISMISSED"); })} className={btn}>ข้าม</button>
      )}
      <button type="button" disabled={pending} onClick={() => { if (confirm("ลบคำถามนี้ออกจากรายการ?")) start(async () => { await deleteUnanswered(id); }); }} className={`${btn} border-red-200 text-red-600`}>ลบ</button>
    </div>
  );
}

export function ClearHandledButton({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending || disabled} onClick={() => { if (confirm("ลบรายการที่ตอบแล้ว/ข้ามแล้วทั้งหมด?")) start(async () => { await clearHandledUnanswered(); }); }} className={btn}>
      ล้างรายการที่จัดการแล้ว
    </button>
  );
}
