"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import BannerCarousel from "@/components/banner-carousel";
import type { PublicBanner } from "@/lib/banners";
import { EFFECTS, LAYOUTS, type SlideEffect, type SlideLayout, type SlideshowConfig } from "@/lib/slideshow";
import { saveSlideshow, type SlideshowState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
      {pending ? "กำลังบันทึก..." : "บันทึกรูปแบบสไลด์"}
    </button>
  );
}

const SAMPLE: PublicBanner[] = [
  ["#0052FF", "#4F8BFF", "ตัวอย่างสไลด์ที่ 1"],
  ["#0F766E", "#34B3A5", "ตัวอย่างสไลด์ที่ 2"],
  ["#6D28D9", "#A78BFA", "ตัวอย่างสไลด์ที่ 3"],
].map(([c1, , title], i) => ({
  id: `sample-${i}`, title, subtitle: "ยังไม่มีสไลด์จริง จึงแสดงตัวอย่างนี้", imageUrl: null, linkUrl: "/", newTab: false, pinned: false, buttonText: "ดูรายละเอียด", bgColor: c1, showText: true,
}));

export default function SlideshowSettings({ initial, banners }: { initial: SlideshowConfig; banners: PublicBanner[] }) {
  const [state, action] = useFormState<SlideshowState, FormData>(saveSlideshow, undefined);
  const [effect, setEffect] = useState<SlideEffect>(initial.effect);
  const [layout, setLayout] = useState<SlideLayout>(initial.layout);
  const [radius, setRadius] = useState(initial.radius);
  const [interval, setIntervalSec] = useState(initial.intervalSec);
  const [autoplay, setAutoplay] = useState(initial.autoplay);
  const [arrows, setArrows] = useState(initial.arrows);
  const [random, setRandom] = useState(initial.randomEffect);
  const [shuffle, setShuffle] = useState(initial.shuffle);

  const config: SlideshowConfig = { effect, layout, radius, intervalSec: interval, autoplay, arrows, randomEffect: random, shuffle };
  const preview = useMemo(() => (banners.length > 0 ? banners : SAMPLE), [banners]);

  return (
    <form action={action} className="space-y-5 rounded-xl bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold">รูปแบบการแสดงสไลด์</h2>
        <p className="text-sm text-neutral-500">ใช้กับสไลด์ทั้งชุดบนหน้าแรก ตัวอย่างด้านล่างเปลี่ยนตามที่เลือกทันที {banners.length === 0 && "(ยังไม่มีสไลด์จริง แสดงตัวอย่างสมมติ)"}</p>
      </div>

      <div className={layout === "full" ? "-mx-5" : ""}>
        <BannerCarousel banners={preview} config={config} preview />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">ลูกเล่นการเปลี่ยนสไลด์</legend>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-brand/50 bg-brand-soft/60 px-3 text-sm font-medium">
          <input type="checkbox" name="random" checked={random} onChange={(e) => setRandom(e.target.checked)} className="h-4 w-4" />
          สุ่มลูกเล่น — ใช้ทั้ง 5 แบบสลับกันไปแบบสุ่ม (ไม่ซ้ำแบบเดิมติดกัน)
        </label>
        {random && <input type="hidden" name="effect" value={effect} />}
        <div className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-5 ${random ? "pointer-events-none opacity-40" : ""}`} aria-disabled={random}>
          {EFFECTS.map((e) => (
            <label key={e.value} className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm ${effect === e.value ? "border-brand bg-brand-soft" : "border-neutral-300 hover:bg-neutral-50"}`}>
              <input type="radio" name="effect" value={e.value} checked={effect === e.value} disabled={random} onChange={() => setEffect(e.value)} className="sr-only" />
              <span className={`font-semibold ${effect === e.value ? "text-brand" : ""}`}>{e.label}</span>
              <span className="text-xs text-neutral-500">{e.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">การจัดวาง</legend>
          <div className="flex gap-2">
            {LAYOUTS.map((l) => (
              <label key={l.value} className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm ${layout === l.value ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>
                <input type="radio" name="layout" value={l.value} checked={layout === l.value} onChange={() => setLayout(l.value)} className="sr-only" />
                {l.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1">
          <span className="text-sm font-medium">
            ความมนของมุม: {radius === 0 ? "เหลี่ยม (ไม่มน)" : `${radius} px`}
            {layout === "full" && <span className="text-neutral-500"> — ไม่ใช้เมื่อเต็มความกว้าง</span>}
          </span>
          <input type="range" name="radius" min={0} max={32} step={2} value={radius} disabled={layout === "full"} onChange={(e) => setRadius(+e.target.value)} className="w-full disabled:opacity-40" />
          {layout === "full" && <input type="hidden" name="radius" value={radius} />}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">เปลี่ยนสไลด์ทุก {interval} วินาที</span>
          <input type="range" name="interval" min={2} max={12} step={1} value={interval} onChange={(e) => setIntervalSec(+e.target.value)} className="w-full" />
        </label>

        <div className="space-y-1">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="shuffle" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} className="h-4 w-4" /> สุ่มลำดับสไลด์ทุกครั้งที่เปิดหน้าเว็บ (สไลด์ที่ปักหมุดอยู่หน้าสุดเสมอ)
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="autoplay" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} className="h-4 w-4" /> เลื่อนอัตโนมัติ
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="arrows" checked={arrows} onChange={(e) => setArrows(e.target.checked)} className="h-4 w-4" /> แสดงปุ่มลูกศรซ้าย/ขวา (เดสก์ท็อป — บนมือถือใช้ปัดนิ้วแทน)
          </label>
        </div>
      </div>

      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">บันทึกแล้ว</p>}
      <Submit />
    </form>
  );
}
