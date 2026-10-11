"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addReviewer, deleteTaxonomy, removeReviewer, saveTaxonomy, type TaxState } from "./actions";

const input = "min-h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm";
type Kind = "area" | "type" | "level";
export type TaxItem = { id: string; slug: string; name: string; icon?: string; color?: string; sortOrder: number; active: boolean; used: number };

function Save({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">{pending ? "…" : children}</button>;
}

/** One row (edit) or the "add" row (item = null) of an areas / types / levels list. */
export function TaxonomyForm({ kind, item }: { kind: Kind; item: TaxItem | null }) {
  const router = useRouter();
  const [state, action] = useFormState<TaxState, FormData>(saveTaxonomy.bind(null, kind, item?.id ?? null), undefined);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3">
      {kind !== "level" && <input name="icon" defaultValue={item?.icon ?? (kind === "area" ? "📖" : "📄")} aria-label="ไอคอน (อีโมจิ)" maxLength={8} className={`${input} w-16 text-center text-lg`} />}
      <input name="name" defaultValue={item?.name ?? ""} placeholder={item ? "" : "ชื่อใหม่"} required aria-label="ชื่อ" maxLength={80} className={`${input} min-w-[180px] flex-1`} />
      {!item && <input name="slug" placeholder="รหัสอังกฤษ เช่น math-fun" required aria-label="รหัสภาษาอังกฤษ" className={`${input} w-44`} />}
      {kind === "area" && <input name="color" type="color" defaultValue={item?.color ?? "#0052FF"} aria-label="สี" className="h-10 w-12 rounded-lg border border-neutral-300 bg-white p-1" />}
      <input name="sortOrder" type="number" min={0} max={999} defaultValue={item?.sortOrder ?? 99} aria-label="ลำดับ" className={`${input} w-20`} />
      {item && <label className="flex min-h-10 items-center gap-1.5 text-sm"><input type="checkbox" name="active" defaultChecked={item.active} className="h-4 w-4" /> แสดง</label>}
      <Save>{item ? "บันทึก" : "เพิ่ม"}</Save>
      {item && (
        <button
          type="button"
          disabled={pending || item.used > 0}
          title={item.used > 0 ? `มีสื่อใช้อยู่ ${item.used} ชิ้น — ปิดการแสดงแทนการลบ` : "ลบ"}
          onClick={() => { if (confirm(`ลบ “${item.name}”?`)) start(async () => { const r = await deleteTaxonomy(kind, item.id); if (r.error) setMsg(r.error); else router.refresh(); }); }}
          className="min-h-10 rounded-lg border border-red-200 px-3 text-sm text-red-600 disabled:opacity-30"
        >
          ลบ
        </button>
      )}
      {item && <span className="text-xs text-neutral-500">{item.used} สื่อ</span>}
      {(state?.error || msg) && <span role="alert" className="w-full text-xs text-red-600">{state?.error ?? msg}</span>}
      {state?.saved && <span role="status" className="text-xs text-green-700">บันทึกแล้ว</span>}
    </form>
  );
}

export function ReviewersPanel({ areaId, reviewers }: { areaId: string; reviewers: { userId: string; name: string; login: string }[] }) {
  const router = useRouter();
  const [state, action] = useFormState<TaxState, FormData>(addReviewer.bind(null, areaId), undefined);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 border-t border-neutral-100 pt-3">
      <p className="text-xs font-medium text-neutral-600">ผู้ตรวจ ({reviewers.length})</p>
      <ul className="flex flex-wrap gap-2">
        {reviewers.map((r) => (
          <li key={r.userId} className="flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-sm">
            <span title={r.login}>{r.name}</span>
            <button type="button" disabled={pending} aria-label={`เอา ${r.name} ออก`} onClick={() => start(async () => { await removeReviewer(areaId, r.userId); router.refresh(); })} className="h-7 w-7 rounded-full text-neutral-500 hover:bg-white">×</button>
          </li>
        ))}
        {reviewers.length === 0 && <li className="text-xs text-neutral-400">ยังไม่มี (แอดมินอนุมัติได้ทุกกลุ่มสาระ)</li>}
      </ul>
      <form action={action} className="flex flex-wrap gap-2">
        <input name="who" placeholder="อีเมลหรือชื่อผู้ใช้ของสมาชิก" aria-label="อีเมลหรือชื่อผู้ใช้ของผู้ตรวจ" className={`${input} min-w-[220px] flex-1`} />
        <Save>แต่งตั้ง</Save>
      </form>
      {state?.error && <p role="alert" className="text-xs text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-xs text-green-700">แต่งตั้งแล้ว</p>}
    </div>
  );
}
