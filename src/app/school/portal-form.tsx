"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import CropImageField, { type CropHandle } from "@/components/admin/crop-image-field";
import { Spinner } from "@/components/icons";
import { saveOwnSchool, type OwnSchoolState } from "./actions";

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="flex min-h-12 items-center gap-2 rounded-lg bg-brand px-7 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending && <Spinner className="h-4 w-4" />}
      {pending ? "กำลังบันทึก (ดึงภาพการ์ดอาจใช้เวลาสักครู่)…" : "บันทึก"}
    </button>
  );
}

export default function SchoolPortalForm({ siteUrl, cardSourceUrl, cardUrl, cardError }: { siteUrl: string; cardSourceUrl: string; cardUrl: string | null; cardError: string | null }) {
  const [state, action] = useFormState<OwnSchoolState, FormData>(saveOwnSchool, undefined);
  const crop = useRef<CropHandle | null>(null);

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <label className="block space-y-1">
        <span className="text-sm font-medium">ลิงก์ Anywhere Anytime ของโรงเรียน</span>
        <input name="siteUrl" defaultValue={siteUrl} placeholder="https://sites.google.com/…" className={input} />
        <span className="block text-xs text-neutral-500">เว้นว่างได้ถ้ายังไม่มีเว็บไซต์</span>
      </label>

      <fieldset className="space-y-3 rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-semibold">ภาพการ์ดของโรงเรียน</legend>
        <label className="block space-y-1">
          <span className="text-sm font-medium">ลิงก์ไฟล์ภาพ/PDF ใน Google Drive (แชร์เป็น “ทุกคนที่มีลิงก์”)</span>
          <input name="cardSourceUrl" defaultValue={cardSourceUrl} placeholder="https://drive.google.com/file/d/…/view" className={input} />
        </label>
        <p className="text-center text-xs text-neutral-400">— หรือ —</p>
        <CropImageField name="card" label="อัปโหลดภาพการ์ดจากเครื่อง (สัดส่วน 16:9)" aspects={[{ label: "16:9", value: 16 / 9 }]} currentUrl={cardUrl} maxWidth={960} handleRef={crop} />
        <p className="text-xs text-neutral-500">ถ้ากรอกลิงก์ Drive ระบบจะดึงภาพมาย่อและเก็บไว้ให้ ถ้าเลือกอัปโหลดภาพจากเครื่อง จะใช้ภาพที่อัปโหลดแทน</p>
        {cardError && <p className="text-xs text-red-600">ครั้งล่าสุดดึงภาพไม่สำเร็จ: {cardError}</p>}
      </fieldset>

      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.warning && <p role="alert" className="text-sm text-amber-700">{state.warning}</p>}
      {state?.saved && !state.warning && <p role="status" className="text-sm text-green-700">บันทึกแล้ว — การเปลี่ยนแปลงแสดงบนหน้าเว็บทันที</p>}
      <Submit />
    </form>
  );
}
