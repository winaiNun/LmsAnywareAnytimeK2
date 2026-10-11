/**
 * Menu names and page headings the admin may reword (text only). Safe for server and client: no database here.
 * A text the admin never set (or cleared) falls back to the built-in default below, so the site never shows an empty label.
 */
export type TextDef = { key: string; group: "menu" | "tabs" | "pages"; label: string; def: string; max: number; long?: boolean };

/** A "|" in an admin-written heading is the admin's own line break. `lineParts` = the lines, `plainText` = the same text on one line. */
export const lineParts = (text: string): string[] => text.split("|").map((x) => x.trim()).filter(Boolean);
export const plainText = (text: string): string => lineParts(text).join(" ");
/** Keys whose text may contain "|" line breaks (headings and descriptions; menu and tab names are one line). */
export const allowsBreaks = (key: string) => key.endsWith(".title") || key.endsWith(".subtitle");
export const MAX_LINES = 4;

export const TEXT_DEFS: TextDef[] = [
  { key: "nav.home", group: "menu", label: "เมนู: หน้าแรก", def: "หน้าแรก", max: 30 },
  { key: "nav.library", group: "menu", label: "เมนู: คลังสื่อ", def: "คลังสื่อ", max: 30 },
  { key: "nav.courses", group: "menu", label: "เมนู: คอร์สเรียน", def: "คอร์สเรียน", max: 30 },
  { key: "nav.schools", group: "menu", label: "เมนู: โรงเรียน", def: "โรงเรียน", max: 30 },
  { key: "nav.about", group: "menu", label: "เมนู: เกี่ยวกับ", def: "เกี่ยวกับ", max: 30 },

  { key: "tab.home", group: "tabs", label: "แท็บล่างมือถือ: หน้าแรก", def: "หน้าแรก", max: 10 },
  { key: "tab.library", group: "tabs", label: "แท็บล่างมือถือ: สื่อ", def: "สื่อ", max: 10 },
  { key: "tab.courses", group: "tabs", label: "แท็บล่างมือถือ: คอร์ส", def: "คอร์ส", max: 10 },
  { key: "tab.schools", group: "tabs", label: "แท็บล่างมือถือ: โรงเรียน", def: "โรงเรียน", max: 10 },

  { key: "library.title", group: "pages", label: "หน้าคลังสื่อ: หัวข้อ", def: "คลังสื่อการเรียนรู้", max: 80 },
  { key: "library.subtitle", group: "pages", label: "หน้าคลังสื่อ: คำอธิบาย (ต่อท้ายจำนวนรายการ)", def: "คลิกเพื่อเปิดใช้งานหรือดาวน์โหลดได้ทันที ไม่ต้องเข้าสู่ระบบ", max: 200, long: true },
  { key: "schools.title", group: "pages", label: "หน้าทำเนียบโรงเรียน: หัวข้อ", def: "ทำเนียบ Anywhere Anytime ของโรงเรียน", max: 80 },
  { key: "schools.subtitle", group: "pages", label: "หน้าทำเนียบโรงเรียน: คำอธิบาย", def: "เว็บไซต์การเรียนรู้ Anywhere Anytime ของทุกโรงเรียนในเขต กดที่การ์ดเพื่อเปิดเว็บไซต์ของโรงเรียน", max: 200, long: true },
  { key: "resources.title", group: "pages", label: "หน้าแหล่งสื่อภายนอก: หัวข้อ", def: "แหล่งสื่อภายนอก", max: 80 },
  { key: "resources.subtitle", group: "pages", label: "หน้าแหล่งสื่อภายนอก: คำอธิบาย", def: "เว็บไซต์และช่องทางที่ผู้ดูแลคัดมาให้ เปิดในแท็บใหม่ ระบบไม่รับผิดชอบเนื้อหาของเว็บภายนอก", max: 200, long: true },
];

export type SiteTexts = Record<string, string>;

export const DEFAULT_TEXTS: SiteTexts = Object.fromEntries(TEXT_DEFS.map((d) => [d.key, d.def]));

/** Saved overrides (any JSON) merged over the defaults; unknown keys, non-strings and blank values are ignored. */
export function resolveTexts(saved: unknown): SiteTexts {
  const out: SiteTexts = { ...DEFAULT_TEXTS };
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    for (const d of TEXT_DEFS) {
      const v = (saved as Record<string, unknown>)[d.key];
      if (typeof v === "string" && v.trim()) out[d.key] = v.trim().slice(0, d.max);
    }
  }
  return out;
}
