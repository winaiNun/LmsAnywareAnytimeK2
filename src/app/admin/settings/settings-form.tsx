"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveSettings, type SettingsState } from "./actions";
import VideoField from "./video-field";

type Initial = {
  systemName: string;
  areaName: string;
  tagline: string;
  heroBgColor: string;
  overlayOpacity: number;
  fadeSeconds: number;
  logoUrl: string | null;
  logoBackdrop: boolean;
  heroVideoUrl: string | null;
  allowServerUploads: boolean;
  requireRegistrationCode: boolean;
};

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

function Submit({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || blocked} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
      {pending ? "กำลังบันทึก..." : blocked ? "รอให้อัปโหลดวิดีโอเสร็จก่อน..." : "บันทึก"}
    </button>
  );
}

export default function SettingsForm({ initial }: { initial: Initial }) {
  const [state, action] = useFormState<SettingsState, FormData>(saveSettings, undefined);
  const [overlay, setOverlay] = useState(initial.overlayOpacity);
  const [fade, setFade] = useState(initial.fadeSeconds);
  const [uploading, setUploading] = useState(false);

  return (
    <form action={action} className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
      <label className="block space-y-1">
        <span className="text-sm font-medium">ชื่อระบบ *</span>
        <input name="systemName" required maxLength={80} defaultValue={initial.systemName} className={input} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">ชื่อเขตพื้นที่</span>
        <input name="areaName" maxLength={120} placeholder="เช่น สำนักงานเขตพื้นที่การศึกษา..." defaultValue={initial.areaName} className={input} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">ข้อความรอง</span>
        <input name="tagline" maxLength={200} defaultValue={initial.tagline} className={input} />
      </label>

      <fieldset className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <legend className="px-1 text-sm font-medium">การสมัครสมาชิก</legend>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" name="requireRegistrationCode" defaultChecked={initial.requireRegistrationCode} className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong>สมัครได้เฉพาะผู้ที่มีรหัสสมัคร</strong>
            <span className="mt-1 block text-neutral-500">เปิดไว้ = ต้องกรอกรหัสที่แอดมินออกให้ (สร้างที่เมนู “รหัสสมัคร”) รหัสกำหนดประเภทสมาชิกและโรงเรียนให้เอง · ปิด = ใครก็สมัครได้โดยเลือกประเภทเอง (เหมาะช่วงทดสอบเท่านั้น)</span>
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <legend className="px-1 text-sm font-medium">การอัปโหลดรูปภาพเข้าเซิร์ฟเวอร์</legend>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" name="allowServerUploads" defaultChecked={initial.allowServerUploads} className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong>อนุญาตให้สมาชิกอัปโหลดรูปเข้าเซิร์ฟเวอร์</strong> (ตอนนี้ใช้กับรูปโปรไฟล์)
            <span className="mt-1 block text-neutral-500">ปิดไว้ = สมาชิกใช้ได้เฉพาะ “ลิงก์ Google Drive สาธารณะ” ไม่มีไฟล์ใหม่เข้ามาในเซิร์ฟเวอร์ — เหมาะช่วงที่ยังไม่มี VPS/ที่เก็บไฟล์ เปิดเมื่อพร้อมแล้ว รูปที่อัปโหลดไว้ก่อนหน้ายังแสดงตามปกติ</span>
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">โลโก้ (PNG/WebP พื้นโปร่งใสได้ ไม่เกิน 4 MB, ระบบย่อไม่เกิน 512 px โดยไม่บิดสัดส่วน และคงความโปร่งใส)</legend>
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm" />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="logoBackdrop" defaultChecked={initial.logoBackdrop} className="h-4 w-4" />
          วางโลโก้บนแผ่นพื้นขาว (เลือกเมื่อโลโก้ไม่โปร่งใส)
        </label>
        {initial.logoUrl && (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={initial.logoUrl} alt="โลโก้ปัจจุบัน" className="h-16 w-16 rounded-lg border border-neutral-200 bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%),linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%)] bg-[length:12px_12px] bg-[position:0_0,6px_6px] object-contain p-1" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removeLogo" /> ลบโลโก้</label>
          </div>
        )}
      </fieldset>

      <VideoField currentUrl={initial.heroVideoUrl} onBusyChange={setUploading} />

      <div className="grid gap-5 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">สีพื้นหลัง (ใต้วิดีโอ)</span>
          <input type="color" name="heroBgColor" defaultValue={initial.heroBgColor} className="h-11 w-full rounded-lg border border-neutral-300 bg-white p-1" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">ความมืดทับวิดีโอ: {overlay}%</span>
          <input type="range" name="overlayOpacity" min={0} max={90} step={5} value={overlay} onChange={(e) => setOverlay(+e.target.value)} className="w-full" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">เฟดวิดีโอเข้า/ออก: {fade} วินาที</span>
          <input type="range" name="fadeSeconds" min={0} max={5} step={0.5} value={fade} onChange={(e) => setFade(+e.target.value)} className="w-full" />
          <span className="block text-xs text-neutral-500">0 = ไม่เฟด</span>
        </label>
      </div>

      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">บันทึกแล้ว</p>}
      <Submit blocked={uploading} />
    </form>
  );
}
