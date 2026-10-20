"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveHonorsSettings, setHonorsHidden, type HonorsAdminState } from "./actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : children}</button>;
}

export function HonorsSettingsForm({ enabled, minItems, canEdit }: { enabled: boolean; minItems: number; canEdit: boolean }) {
  const [state, action] = useFormState<HonorsAdminState, FormData>(saveHonorsSettings, undefined);
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">ตั้งค่าหน้าเชิดชู</h2>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" name="honorsEnabled" defaultChecked={enabled} disabled={!canEdit} className="mt-0.5 h-5 w-5 shrink-0" />
        <span><strong>เปิดหน้าเชิดชูและเซกชันบนหน้าแรก</strong><span className="block text-neutral-500">ปิด = หน้า /honors แจ้งว่าปิดให้บริการ และเซกชันบนหน้าแรกหายไป (ข้อมูลที่สมาชิกเลือกไว้ไม่หาย)</span></span>
      </label>
      <label className="block max-w-xs space-y-1">
        <span className="text-sm font-medium">ผลงานที่เผยแพร่แล้วขั้นต่ำเพื่อขึ้นอันดับ / การ์ดหน้าแรก (สื่อ + คอร์ส)</span>
        <input name="honorsMinItems" type="number" min={1} max={100} defaultValue={minItems} disabled={!canEdit} className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">บันทึกแล้ว</p>}
      {canEdit ? <Submit>บันทึก</Submit> : <p className="text-sm text-neutral-500">เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ค่านี้ได้</p>}
    </form>
  );
}

export function HideButton({ userId, hidden }: { userId: string; hidden: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!hidden && !confirm("ซ่อนสมาชิกคนนี้ออกจากหน้าเชิดชู? (สมาชิกยังเห็นสถานะในหน้าบัญชีของตน)")) return;
          start(async () => {
            const r = await setHonorsHidden(userId, !hidden);
            setError(r.error ?? "");
          });
        }}
        className={`min-h-9 rounded-lg border px-3 text-sm disabled:opacity-50 ${hidden ? "border-green-300 text-green-700" : "border-red-200 text-red-600"}`}
      >
        {hidden ? "คืนสิทธิ์แสดง" : "ซ่อนจากหน้าเชิดชู"}
      </button>
      {error && <span role="alert" className="ml-2 text-xs text-red-600">{error}</span>}
    </>
  );
}
