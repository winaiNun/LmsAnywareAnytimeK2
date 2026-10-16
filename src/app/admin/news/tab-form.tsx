"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/lib/news/merge";
import { saveTab, type NewsFormState } from "./actions";

export type TabValues = { id?: string; name: string; pageSize: number; active: boolean };

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : children}</button>;
}

/** Add (no id) or edit one news tab (หัวข้อข่าว). */
export default function TabForm({ values }: { values: TabValues }) {
  const router = useRouter();
  const [nonce, setNonce] = useState(0);
  const isNew = !values.id;
  const [state, action] = useFormState<NewsFormState, FormData>(saveTab.bind(null, values.id ?? null), undefined);

  useEffect(() => {
    if (!state?.saved) return;
    if (isNew) setNonce((n) => n + 1);
    router.refresh();
  }, [state, router, isNew]);

  return (
    <form action={action} key={`${values.id ?? "new"}-${nonce}`} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{isNew ? "เพิ่มหัวข้อข่าว (แถบ)" : "แก้ไขหัวข้อข่าว"}</h2>
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <label className="block space-y-1">
          <span className="text-sm font-medium">ชื่อหัวข้อ (ชื่อที่แสดงบนแถบ) *</span>
          <input name="name" required maxLength={60} defaultValue={values.name} placeholder="เช่น ข่าวประชาสัมพันธ์ / นโยบาย / กิจกรรม" className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">ข่าวต่อหน้า ({MIN_PAGE_SIZE}–{MAX_PAGE_SIZE})</span>
          <input name="pageSize" type="number" inputMode="numeric" min={MIN_PAGE_SIZE} max={MAX_PAGE_SIZE} required defaultValue={values.pageSize} className={input} />
        </label>
      </div>
      <p className="text-xs text-neutral-500">ข่าวทุกรายการในหัวข้อนี้ (ทั้งลิงก์ที่พิมพ์เองและข่าวจาก RSS) รวมเป็นรายการเดียวเรียงจากใหม่ไปเก่า แล้วแบ่งหน้าตามจำนวนนี้ทั้งบนหน้าแรกและหน้า “ข่าวสาร” · แนะนำเลขคู่ (6, 8, 10) เพราะหน้าจอกว้างแสดง 2 คอลัมน์</p>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={values.active} className="h-4 w-4" /> แสดงบนเว็บไซต์</label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">{isNew ? "เพิ่มแล้ว — ดูในรายการด้านล่าง" : "บันทึกแล้ว"}</p>}
      <div className="flex flex-wrap gap-2">
        <Submit>{isNew ? "เพิ่มหัวข้อ" : "บันทึก"}</Submit>
        {!isNew && <a href="/admin/news?view=tabs" className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-5 text-sm">เลิกแก้ไข</a>}
      </div>
    </form>
  );
}
