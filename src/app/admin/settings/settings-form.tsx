"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveSettings, type SettingsState } from "./actions";
import CropImageField from "@/components/admin/crop-image-field";
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
  heroImageUrl: string | null;
  heroImageAnimated: boolean;
  allowServerUploads: boolean;
  requireRegistrationCode: boolean;
  heroGlobe: boolean;
  heroGlobeStrength: number;
  motionLevel: string;
};

const HERO_ASPECTS = [
  { label: "16:9 (แนะนำ)", value: 16 / 9 },
  { label: "21:9 กว้าง", value: 21 / 9 },
  { label: "4:3", value: 4 / 3 },
];

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
  const [strength, setStrength] = useState(initial.heroGlobeStrength);
  const [uploading, setUploading] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);

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

      <fieldset className="space-y-3 rounded-xl border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium">พื้นหลังแบนเนอร์: ภาพ / GIF หรือ วิดีโอ (เลือกอย่างใดอย่างหนึ่ง)</legend>
        <p className="text-xs text-neutral-500">อัปโหลดอันใหม่จะแทนที่อันเดิมโดยอัตโนมัติ ถ้าไม่ใส่อะไรเลยจะเป็นพื้นสีพร้อมแสงเคลื่อนไหวช้าๆ</p>

        <CropImageField
          name="heroImage"
          label="ภาพพื้นหลัง (PNG, JPG, WebP หรือ GIF)"
          aspects={HERO_ASPECTS}
          currentUrl={removeImage ? null : initial.heroImageUrl}
          maxWidth={1920}
          recommendedWidth={1920}
          minWidth={1600}
          safeZone
          allowGif
        />
        <div className="space-y-1 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
          <p><strong>ขนาดที่แนะนำ:</strong> ภาพนิ่ง <strong>1920×1080 px (16:9)</strong> ขั้นต่ำกว้าง 1600 px · แบนเนอร์เต็มความกว้างและสูง 460–580 px จึงเห็นเฉพาะแถบกลางภาพบนคอมพิวเตอร์ และเห็นเฉพาะส่วนกลางบนมือถือ — วางสิ่งสำคัญไว้กลางภาพ (กรอบ “พื้นที่ปลอดภัย”) และเลี่ยงตัวหนังสือในภาพ เพราะมีชื่อระบบวางทับอยู่แล้ว</p>
          <p><strong>ภาพนิ่ง:</strong> เลือกไฟล์แล้วครอบ/ซูมได้ ระบบย่อเป็น WebP กว้างไม่เกิน 1920 px ให้เบาโดยอัตโนมัติ</p>
          <p><strong>GIF เคลื่อนไหว:</strong> ไม่เกิน 4 MB · แนะนำกว้าง 1280 px ความยาวไม่เกิน ~10 วินาที · เลือก GIF แล้ว<strong>จะไม่เปิดเครื่องมือครอบ</strong> (การครอบจะทำให้ภาพหยุดนิ่ง) ให้ครอบ/ย่อไฟล์ก่อนอัปโหลด เช่นที่ ezgif.com · ระบบแปลงเป็น WebP เคลื่อนไหวให้ตอนบันทึก ไฟล์เล็กลงมากและเล่นวนเองบนทุกเบราว์เซอร์ · ผู้ที่ตั้งค่า “ลดการเคลื่อนไหว” ในเครื่องจะเห็นเป็นสีพื้นแทน</p>
          <p>GIF ที่ยาวหรือภาพละเอียดมากจะหนักกว่าวิดีโอ ถ้าต้องการภาพเคลื่อนไหวนานๆ แนะนำใช้วิดีโอ MP4 ด้านล่างแทน</p>
        </div>
        {initial.heroImageUrl && (
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" name="removeHeroImage" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} className="h-4 w-4" />
            ลบภาพพื้นหลังปัจจุบัน{initial.heroImageAnimated ? " (เป็นภาพเคลื่อนไหว)" : ""}
          </label>
        )}
      </fieldset>

      <VideoField currentUrl={initial.heroVideoUrl} onBusyChange={setUploading} />

      <fieldset className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <legend className="px-1 text-sm font-medium">แอนิเมชันในแบนเนอร์ชื่อระบบ</legend>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" name="heroGlobe" defaultChecked={initial.heroGlobe} className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong>แสดงลูกโลกจุดเชื่อมเส้นที่หมุนและเอียงตามเมาส์</strong>
            <span className="mt-1 block text-neutral-500">วาดทับพื้นหลัง (สี ภาพ GIF หรือวิดีโอ) ผู้ชมมีปุ่มหยุด/เล่นแอนิเมชันที่มุมแบนเนอร์เอง (จำค่าไว้ในเบราว์เซอร์) และผู้ที่ตั้งค่า “ลดการเคลื่อนไหว” ในเครื่องจะเห็นเป็นภาพนิ่งจนกว่าจะกดเล่นเอง · ปิดไว้ = ไม่มีแอนิเมชันและไม่มีปุ่ม</span>
          </span>
        </label>
        <label className="block space-y-1 pl-8">
          <span className="text-sm font-medium">ความเข้มของลูกโลก: {strength}%</span>
          <input type="range" name="heroGlobeStrength" min={20} max={100} step={5} value={strength} onChange={(e) => setStrength(+e.target.value)} className="w-full max-w-md" />
          <span className="block text-xs text-neutral-500">ลดลง = จางลง กลืนไปกับพื้นหลัง · เพิ่ม = เห็นจุดและเส้นชัดขึ้น (หลังบันทึก ดูผลที่หน้าแรก) · ถ้าพื้นหลังสว่างมากแล้วลูกโลกรบกวนตัวหนังสือ ให้ลดลงหรือเพิ่ม “ความมืดทับพื้นหลัง” ด้านล่าง</span>
        </label>
      </fieldset>

      <fieldset className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <legend className="px-1 text-sm font-medium">เอฟเฟกต์ตอนเลื่อนหน้าแรก</legend>
        {[
          ["off", "ปิด", "ไม่มีเอฟเฟกต์ เนื้อหาแสดงทันที (เหมาะกับเครื่องเก่าหรืออินเทอร์เน็ตช้า)"],
          ["light", "เบา (แนะนำ)", "เซกชันและการ์ดเฟดและลอยขึ้นเบาๆ เมื่อเลื่อนมาถึง"],
          ["full", "เต็ม", "การ์ดซูมเข้าและไล่ทีละใบ ดูว้าวขึ้น"],
        ].map(([v, label, hint]) => (
          <label key={v} className="flex min-h-11 items-start gap-3 text-sm">
            <input type="radio" name="motionLevel" value={v} defaultChecked={initial.motionLevel === v} className="mt-0.5 h-5 w-5 shrink-0" />
            <span><strong>{label}</strong><span className="mt-0.5 block text-neutral-500">{hint}</span></span>
          </label>
        ))}
        <p className="text-xs text-neutral-500">ผู้ที่ตั้งค่า “ลดการเคลื่อนไหว” ในเครื่องจะไม่เห็นเอฟเฟกต์เสมอ</p>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">สีพื้นหลัง (ใต้ภาพ/วิดีโอ)</span>
          <input type="color" name="heroBgColor" defaultValue={initial.heroBgColor} className="h-11 w-full rounded-lg border border-neutral-300 bg-white p-1" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">ความมืดทับพื้นหลัง: {overlay}%</span>
          <input type="range" name="overlayOpacity" min={0} max={90} step={5} value={overlay} onChange={(e) => setOverlay(+e.target.value)} className="w-full" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">เฟดวิดีโอเข้า/ออก (เฉพาะวิดีโอ): {fade} วินาที</span>
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
