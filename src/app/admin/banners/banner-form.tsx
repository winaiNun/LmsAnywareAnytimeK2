"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import CropImageField, { type CropHandle } from "@/components/admin/crop-image-field";
import LinkPicker from "@/components/admin/link-picker";
import ThaiDateField from "@/components/thai-date-field";
import type { LinkGroup } from "@/lib/link-targets";
import { SLIDE_SIZE, isExternalUrl } from "@/lib/slideshow";
import { saveBanner, type BannerFormState } from "./actions";
import DrivePicker from "./drive-picker";

type Initial = {
  id: string;
  title: string;
  subtitle: string | null;
  linkUrl: string | null;
  sourceUrl: string | null;
  newTab: boolean;
  buttonText: string | null;
  bgColor: string;
  active: boolean;
  showText: boolean;
  startAt: string; // ISO instant or ""
  endAt: string;
  imageUrl: string | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
      {pending ? "กำลังบันทึก..." : "บันทึก"}
    </button>
  );
}

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

export default function BannerForm({ initial, linkGroups, isAdmin }: { initial?: Initial; linkGroups: LinkGroup[]; isAdmin: boolean }) {
  const [state, action] = useFormState<BannerFormState, FormData>(saveBanner.bind(null, initial?.id ?? null), undefined);
  const [link, setLink] = useState(initial?.linkUrl ?? "");
  const [buttonText, setButtonText] = useState(initial?.buttonText ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [newTab, setNewTab] = useState(initial?.newTab ?? false);
  const cropRef = useRef<CropHandle | null>(null);
  // set when the image came from a Google Drive link; cleared if the author uploads a file instead
  const [source, setSource] = useState(initial?.sourceUrl ?? "");
  const external = isExternalUrl(link);

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
      {!isAdmin && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">เมื่อบันทึก สไลด์นี้จะอยู่ในสถานะ <strong>รอแอดมินเผยแพร่</strong> และจะขึ้นบนหน้าเว็บหลังแอดมินอนุมัติ</p>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-medium">หัวข้อ (ชื่อคอร์ส/สื่อ) *</span>
        <input name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">คำอธิบายสั้น</span>
        <textarea name="subtitle" maxLength={300} rows={2} defaultValue={initial?.subtitle ?? ""} className={`${input} py-2`} />
      </label>

      <div className="space-y-1">
        <span className="text-sm font-medium">ลิงก์ปลายทาง</span>
        <LinkPicker
          name="linkUrl"
          defaultValue={initial?.linkUrl ?? ""}
          groups={linkGroups}
          onValueChange={setLink}
          onPick={(o) => {
            // fill the title/button for the admin when they are still empty
            if (!title.trim() && o.url !== "/" && !o.url.startsWith("/#") && o.url !== "/login") setTitle(o.label);
            if (!buttonText.trim()) setButtonText(o.url.startsWith("/courses/") ? "ดูคอร์สนี้" : o.url.startsWith("/library/") ? "ดูสื่อนี้" : "");
          }}
        />
        <label className={`flex min-h-9 items-center gap-2 text-sm ${external ? "text-neutral-500" : ""}`}>
          <input type="checkbox" name="newTab" checked={external || newTab} onChange={(e) => setNewTab(e.target.checked)} disabled={external} className="h-4 w-4" />
          เปิดในแท็บใหม่ {external && "(ลิงก์ภายนอกเปิดแท็บใหม่เสมอ)"}
        </label>
        {external && <input type="hidden" name="newTab" value="on" />}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">ข้อความบนปุ่ม</span>
          <input name="buttonText" maxLength={40} placeholder="ดูรายละเอียด" value={buttonText} onChange={(e) => setButtonText(e.target.value)} className={input} />
        </label>
        <ThaiDateField name="startAt" label="แสดงตั้งแต่ (พ.ศ.)" withTime defaultValue={initial?.startAt} defaultTime={{ hour: 0, minute: 0 }} />
        <ThaiDateField name="endAt" label="แสดงถึง (พ.ศ.)" withTime defaultValue={initial?.endAt} defaultTime={{ hour: 23, minute: 59 }} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">สีพื้นหลัง (เมื่อไม่มีรูป)</span>
          <input type="color" name="bgColor" defaultValue={initial?.bgColor ?? "#EAF0FF"} className="h-11 w-full rounded-lg border border-neutral-300 bg-white p-1" />
        </label>
      </div>

      {/* what to hand a teacher / member who prepares the artwork */}
      <div className="space-y-2 rounded-xl border border-brand/30 bg-brand-soft p-4 text-sm">
        <p className="font-semibold text-brand">ขนาดรูปที่แนะนำ</p>
        <ul className="list-disc space-y-1 pl-5 text-neutral-700">
          <li>
            <strong>{SLIDE_SIZE.width} × {SLIDE_SIZE.height} พิกเซล</strong> สัดส่วน <strong>3 : 1</strong> (กว้างเป็น 3 เท่าของสูง) — ขนาดต่ำสุดที่ยังคมคือกว้าง {SLIDE_SIZE.minWidth} px
          </li>
          <li>ไฟล์ JPG, PNG หรือ WebP ไม่เกิน 10 MB — ระบบครอบและย่อเป็น WebP ให้เอง (เหลือราว 10–100 KB)</li>
          <li>ข้อความสำคัญควรอยู่<strong>กลางภาพ ห่างขอบประมาณ 6%</strong> และตัวอักษรใหญ่ (สูงอย่างน้อย 80 px ในรูปขนาดเต็ม) เพราะบนมือถือรูปจะเล็กลงมาก</li>
          <li>ถ้าในรูปมีข้อความอยู่แล้ว ให้ปิดช่อง “แสดงหัวข้อ/ปุ่มทับบนรูป” ด้านล่าง</li>
        </ul>
      </div>

      <CropImageField
        name="image"
        label={`รูปป้ายสไลด์ (ครอบเป็น 3:1, แนะนำ ${SLIDE_SIZE.width}×${SLIDE_SIZE.height} px)`}
        aspects={[{ label: "3:1", value: SLIDE_SIZE.ratio }]}
        currentUrl={initial?.imageUrl ?? null}
        maxWidth={SLIDE_SIZE.width}
        recommendedWidth={SLIDE_SIZE.width}
        minWidth={SLIDE_SIZE.minWidth}
        safeZone
        handleRef={cropRef}
        onLocalChoose={() => setSource("")}
      />
      <input type="hidden" name="sourceUrl" value={source} />
      <DrivePicker onFile={(file, viewUrl) => { setSource(viewUrl); cropRef.current?.openFile(file); }} />
      {source && <p className="text-xs text-neutral-500">ที่มาของภาพ: <a href={source} target="_blank" rel="noopener noreferrer" className="text-brand underline">Google Drive</a></p>}
      {initial?.imageUrl && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="removeImage" /> ลบรูปปัจจุบัน
        </label>
      )}

      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="showText" defaultChecked={initial?.showText ?? true} className="h-4 w-4" />
        <span>แสดงหัวข้อ/ปุ่มทับบนรูป (ปิดไว้ถ้าในรูปมีข้อความอยู่แล้ว)</span>
      </label>

      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="h-4 w-4" />
        <span>เปิดใช้งาน</span>
      </label>

      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <Submit />
        <a href="/admin/banners" className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-6">ยกเลิก</a>
      </div>
    </form>
  );
}
