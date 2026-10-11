"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import ColorPicker from "@/components/admin/color-picker";
import CropImageField from "@/components/admin/crop-image-field";
import SectionHeading from "@/components/section-heading";
import { DIRECTIONS, HEADING_STYLES, HEADING_STYLE_LABEL, sectionBackground, type BG_MODES } from "@/lib/section-styles";
import type { HomeSectionConfig } from "@/lib/sections";
import { saveSection, type SectionState } from "./actions";

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
      {pending ? "กำลังบันทึก..." : "บันทึก"}
    </button>
  );
}

const ALIGN_LABEL = { left: "ซ้าย", center: "กลาง", right: "ขวา" } as const;
const SIZE_LABEL = { sm: "เล็ก", md: "กลาง", lg: "ใหญ่" } as const;
const MODE_LABEL: Record<(typeof BG_MODES)[number], string> = { none: "ไม่มี", solid: "สีเดียว", gradient: "ไล่สี 2 สี", image: "ภาพ" };
const BG_ASPECTS = [
  { label: "16:9", value: 16 / 9 },
  { label: "21:9", value: 21 / 9 },
  { label: "3:1", value: 3 },
];

function Choice({ checked, onChange, name, value, children }: { checked: boolean; onChange: () => void; name: string; value: string; children: React.ReactNode }) {
  return (
    <label className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm ${checked ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

export default function SectionForm({ section }: { section: HomeSectionConfig }) {
  const [state, action] = useFormState<SectionState, FormData>(saveSection.bind(null, section.key), undefined);
  const [title, setTitle] = useState(section.title);
  const [subtitle, setSubtitle] = useState(section.subtitle);
  const [align, setAlign] = useState(section.align);
  const [size, setSize] = useState(section.titleSize);
  const [color, setColor] = useState(section.titleColor);
  const [hStyle, setHStyle] = useState(section.headingStyle);
  const [eyebrow, setEyebrow] = useState(section.eyebrow);
  const [hideEyebrow, setHideEyebrow] = useState(false);
  const [accent, setAccent] = useState(section.accentColor);
  const [showMore, setShowMore] = useState(section.showMore);
  const [mode, setMode] = useState(section.bgMode);
  const [c1, setC1] = useState(section.bgColor ?? "#EAF0FF");
  const [c2, setC2] = useState(section.bgColor2 ?? "#FFFFFF");
  const [dir, setDir] = useState(section.bgDirection);
  const [overlay, setOverlay] = useState(section.bgOverlay);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const imageUrl = removeImage ? null : (newImage ?? section.bgImageUrl);
  const bg = sectionBackground({ mode, color: c1, color2: c2, direction: dir, imageUrl, overlay });

  return (
    <form action={action} className="space-y-6">
      {/* live preview of the section heading on its background */}
      <div role="group" aria-label="ตัวอย่าง" className="relative overflow-hidden rounded-lg border border-neutral-200 bg-[#F9F9F9]" style={bg.style}>
        {bg.overlay > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bg.overlay / 100 }} />}
        <div className={`relative px-4 py-8 ${bg.tone === "light" ? "text-white" : "text-neutral-900"}`}>
          <div className="pointer-events-none">
            <SectionHeading
              style={hStyle}
              title={title || "—"}
              subtitle={subtitle}
              eyebrow={hideEyebrow ? "" : eyebrow}
              accent={accent}
              align={align}
              size={size}
              titleColor={color}
              moreHref={showMore && section.hasMore ? "#" : null}
              icon={section.icon}
              onDark={bg.tone === "light"}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">ข้อความกำกับเซกชัน * <span className="font-normal text-neutral-500">(พิมพ์ | เพื่อขึ้นบรรทัดใหม่)</span></span>
          <input name="title" required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">ข้อความรอง (ไม่บังคับ) <span className="font-normal text-neutral-500">(พิมพ์ | เพื่อขึ้นบรรทัดใหม่)</span></span>
          <input name="subtitle" maxLength={160} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={input} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">ตำแหน่งข้อความ</legend>
          <div className="flex gap-2">
            {(["left", "center", "right"] as const).map((a) => (
              <Choice key={a} name="align" value={a} checked={align === a} onChange={() => setAlign(a)}>{ALIGN_LABEL[a]}</Choice>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">ขนาดตัวอักษร</legend>
          <div className="flex gap-2">
            {(["sm", "md", "lg"] as const).map((s) => (
              <Choice key={s} name="titleSize" value={s} checked={size === s} onChange={() => setSize(s)}>{SIZE_LABEL[s]}</Choice>
            ))}
          </div>
        </fieldset>
      </div>

      <ColorPicker label="สีข้อความ" name="titleColor" value={color} onChange={setColor} />

      <fieldset className="space-y-4 rounded-lg border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-semibold">รูปแบบหัวข้อ</legend>
        <div className="flex flex-wrap gap-2">
          {HEADING_STYLES.map((h) => (
            <Choice key={h} name="headingStyle" value={h} checked={hStyle === h} onChange={() => setHStyle(h)}>{HEADING_STYLE_LABEL[h]}</Choice>
          ))}
        </div>
        {hStyle !== "plain" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium">ป้ายเล็กเหนือหัวข้อ (เว้นว่าง = ใช้ข้อความมาตรฐานของเซกชัน)</span>
                <input name="eyebrow" maxLength={24} value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} disabled={hideEyebrow} className={input} />
              </label>
              <label className="flex min-h-11 items-center gap-2 self-end text-sm">
                <input type="checkbox" name="hideEyebrow" checked={hideEyebrow} onChange={(e) => setHideEyebrow(e.target.checked)} className="h-4 w-4" /> ไม่แสดงป้ายเล็ก
              </label>
            </div>
            <ColorPicker label="สีเน้น (ป้าย เส้นใต้หัวข้อ ปุ่ม “ดูทั้งหมด”)" name="accentColor" value={accent} onChange={setAccent} />
          </>
        )}
        {hStyle === "plain" && <input type="hidden" name="accentColor" value={accent} />}
        {section.hasMore && hStyle !== "plain" && (
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" name="showMore" checked={showMore} onChange={(e) => setShowMore(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <strong>แสดงปุ่ม “ดูทั้งหมด” ที่หัวข้อ</strong>
              <span className="block text-neutral-500">พาไปหน้ารวมของเซกชันนี้ ปิดได้ถ้าเนื้อหาด้านล่างมีทางไปหน้ารวมอยู่แล้ว (เช่น เมนูกลุ่มสาระแสดงครบทุกกลุ่ม หรือปุ่มท้ายรายการ)</span>
            </span>
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-semibold">พื้นหลังเซกชัน</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MODE_LABEL) as (typeof BG_MODES)[number][]).map((m) => (
            <Choice key={m} name="bgMode" value={m} checked={mode === m} onChange={() => setMode(m)}>{MODE_LABEL[m]}</Choice>
          ))}
        </div>

        {(mode === "solid" || mode === "gradient") && (
          <ColorPicker label={mode === "solid" ? "สีพื้นหลัง" : "สีที่ 1 (ต้นทาง)"} name="bgColor" value={c1} onChange={setC1} />
        )}
        {mode === "gradient" && (
          <>
            <ColorPicker label="สีที่ 2 (ปลายทาง)" name="bgColor2" value={c2} onChange={setC2} />
            <label className="block space-y-1">
              <span className="text-sm font-medium">ทิศทางการไล่สี</span>
              <select name="bgDirection" value={dir} onChange={(e) => setDir(e.target.value)} className={input}>
                {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </label>
          </>
        )}
        {mode === "image" && (
          <div className="space-y-3">
            <CropImageField name="bgImage" label="ภาพพื้นหลัง" aspects={BG_ASPECTS} currentUrl={removeImage ? null : section.bgImageUrl} maxWidth={1920} onPreview={setNewImage} />
            {section.bgImageUrl && (
              <label className="flex min-h-9 items-center gap-2 text-sm">
                <input type="checkbox" name="removeBgImage" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} className="h-4 w-4" /> ลบภาพพื้นหลังปัจจุบัน
              </label>
            )}
            <label className="block space-y-1">
              <span className="text-sm font-medium">ความมืดทับภาพ (ช่วยให้ตัวอักษรอ่านง่าย): {overlay}%</span>
              <input type="range" name="bgOverlay" min={0} max={80} step={5} value={overlay} onChange={(e) => setOverlay(+e.target.value)} className="w-full" />
            </label>
            {!imageUrl && <p className="text-xs text-amber-700">ยังไม่มีภาพ จะแสดงเป็นพื้นหลังปกติจนกว่าจะเลือกภาพ</p>}
          </div>
        )}
      </fieldset>

      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="visible" defaultChecked={section.visible} className="h-4 w-4" />
        <span>แสดงเซกชันนี้ในหน้าแรก</span>
      </label>

      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">บันทึกแล้ว</p>}
      <Submit />
    </form>
  );
}
