"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { approveUsers, rejectUser, setApprovalMode, unlockAll } from "./actions";

const btn = "min-h-10 whitespace-nowrap rounded-lg border px-3 text-sm font-medium disabled:opacity-50";

/** Training mode switch. */
export function ModeSwitch({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          if (!next || confirm("เปิดโหมดอบรม?\nผู้สมัครไม่ต้องใช้รหัสสมัคร และเลือกประเภทสมาชิก/โรงเรียนเอง ทุกบัญชีต้องรอคุณอนุมัติที่หน้านี้ก่อนจึงเข้าสู่ระบบได้"))
            start(async () => { await setApprovalMode(next); });
        }}
        className="mt-0.5 h-6 w-6 shrink-0"
      />
      <span>
        <strong className="text-base">โหมดอบรม: สมัครโดยไม่ใช้รหัส แล้วผู้ดูแลอนุมัติเอง</strong>
        <span className="mt-1 block text-sm text-neutral-500">
          {on
            ? "เปิดอยู่ — ผู้สมัครใหม่จะมาขึ้นในรายการด้านล่าง อย่าลืมปิดเมื่ออบรมเสร็จ"
            : "ปิดอยู่ — สมัครตามปกติ (ใช้รหัสสมัครตามที่ตั้งไว้ในเมนูตั้งค่า) · ผู้ที่สมัครไว้ระหว่างโหมดอบรมยังอนุมัติได้ที่หน้านี้"}
        </span>
      </span>
    </label>
  );
}

/** Approve / reject one waiting account. */
export function RowButtons({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await approveUsers([id]); setError(r.error ?? ""); })} className={`${btn} border-green-600 bg-green-600 text-white`}>
        อนุมัติ
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => { if (confirm(`ไม่อนุมัติและลบบัญชี “${name}”?`)) start(async () => { const r = await rejectUser(id); setError(r.error ?? ""); }); }}
        className={`${btn} border-red-300 text-red-700`}
      >
        ไม่อนุมัติ
      </button>
      {error && <span role="alert" className="w-full text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}

/** Approve every account in the list at once. */
export function ApproveAll({ ids }: { ids: string[] }) {
  const [pending, start] = useTransition();
  if (ids.length < 2) return null;
  return (
    <button type="button" disabled={pending} onClick={() => { if (confirm(`อนุมัติทั้งหมด ${ids.length} บัญชี?`)) start(async () => { await approveUsers(ids); }); }} className={`${btn} border-green-600 bg-green-600 text-white`}>
      อนุมัติทั้งหมด ({ids.length})
    </button>
  );
}

/** Clears every sign-in / sign-up counter. */
export function UnlockButton({ locked }: { locked: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await unlockAll(); setMsg(r.error ?? `ปลดล็อกแล้ว (ล้างตัวนับ ${r.cleared ?? 0} รายการ)`); })} className={`${btn} border-neutral-300 bg-white`}>
        ปลดล็อกการเข้าสู่ระบบ/สมัครทั้งหมด
      </button>
      <span className={`text-sm ${locked > 0 ? "font-semibold text-red-600" : "text-neutral-500"}`}>{locked > 0 ? `ตอนนี้ติดล็อกอยู่ ${locked} รายการ` : "ตอนนี้ไม่มีใครติดล็อก"}</span>
      {msg && <span role="status" className="text-sm text-green-700">{msg}</span>}
    </div>
  );
}

/** While training mode is on, new sign-ups appear without pressing reload. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
