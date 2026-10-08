// Pure constants/types (no database import) so client components can use them too.
export const EFFECTS = [
  { value: "slide", label: "เลื่อนข้าง", hint: "ลากตามนิ้วได้ลื่นที่สุด" },
  { value: "fade", label: "เฟดจาง", hint: "ภาพค่อยๆ ซ้อนกัน นุ่มนวล" },
  { value: "zoom", label: "ซูมเนียน", hint: "เฟด + ภาพค่อยๆ ซูมแบบภาพยนตร์" },
  { value: "wipe", label: "รูดเปิด", hint: "ภาพใหม่รูดเปิดจากขวาไปซ้าย" },
  { value: "blur", label: "โฟกัสภาพ", hint: "ภาพใหม่ชัดขึ้นจากความพร่ามัว" },
] as const;
export type SlideEffect = (typeof EFFECTS)[number]["value"];
export const EFFECT_VALUES = EFFECTS.map((e) => e.value) as [SlideEffect, ...SlideEffect[]];

export const LAYOUTS = [
  { value: "contained", label: "อยู่ในกรอบเนื้อหา" },
  { value: "full", label: "เต็มความกว้างหน้าจอ" },
] as const;
export type SlideLayout = (typeof LAYOUTS)[number]["value"];

export type SlideshowConfig = {
  radius: number; // px
  effect: SlideEffect;
  intervalSec: number;
  layout: SlideLayout;
  autoplay: boolean;
  arrows: boolean;
  randomEffect: boolean; // use every effect, a different random one for each change
  shuffle: boolean; // shuffle slide order on each page load (pinned slides stay first)
};

export const DEFAULT_SLIDESHOW: SlideshowConfig = {
  radius: 0,
  effect: "slide",
  intervalSec: 5,
  layout: "contained",
  autoplay: true,
  arrows: true,
  randomEffect: false,
  shuffle: false,
};

/** Recommended artwork size for slides (3:1). Shown to whoever prepares the images. */
export const SLIDE_SIZE = { width: 1800, height: 600, minWidth: 1200, ratio: 3 } as const;

/** Internal paths stay in the same tab; anything with a scheme is external. */
export const isExternalUrl = (url: string | null | undefined) => !!url && /^https?:\/\//i.test(url);
