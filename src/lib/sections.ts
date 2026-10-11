import { db } from "@/lib/db";
import { ALIGNS, BG_MODES, BRAND_ACCENT, DIRECTION_VALUES, HEADING_STYLES, SIZES } from "@/lib/section-styles";
import { fileUrl } from "@/lib/site";

export { ALIGNS, SIZES, BG_MODES, HEADING_ALIGN, HEADING_SIZE } from "@/lib/section-styles";

export const SECTION_KEYS = ["recommended", "areas", "latest", "popular", "courses", "schools", "resources"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export type HomeSectionConfig = {
  key: SectionKey;
  kind: string; // what the block shows, for the admin list
  title: string;
  subtitle: string;
  visible: boolean;
  sortOrder: number;
  align: (typeof ALIGNS)[number];
  titleSize: (typeof SIZES)[number];
  titleColor: string;
  bgMode: (typeof BG_MODES)[number];
  bgColor: string | null;
  bgColor2: string | null;
  bgDirection: string;
  bgImageUrl: string | null;
  bgOverlay: number;
  headingStyle: (typeof HEADING_STYLES)[number];
  eyebrow: string; // "" = no label
  accentColor: string;
  moreHref: string | null; // where the "see all" button points (null = this block has none); already null when switched off
  hasMore: boolean; // does this block have a "see all" target at all (shows the switch in the admin)
  showMore: boolean; // is the button switched on
  icon: string; // used by the icon heading style
};

type Defaults = Omit<HomeSectionConfig, "key" | "sortOrder" | "headingStyle" | "accentColor" | "hasMore" | "showMore"> & { moreDefault?: boolean };
const base: Omit<Defaults, "kind" | "title"> = {
  subtitle: "",
  visible: true,
  align: "left",
  titleSize: "md",
  titleColor: "#1E1E1E",
  bgMode: "none",
  bgColor: null,
  bgColor2: null,
  bgDirection: "to right",
  bgImageUrl: null,
  bgOverlay: 0,
  eyebrow: "",
  moreHref: null,
  icon: "book-open",
};

const DEFAULTS: Record<SectionKey, Defaults> = {
  recommended: { ...base, eyebrow: "แนะนำ", icon: "sparkles", kind: "สไลด์แนะนำคอร์ส/สื่อ", title: "แนะนำสำหรับคุณ" },
  areas: { ...base, eyebrow: "กลุ่มสาระ", icon: "book-open", moreHref: "/library", moreDefault: false, kind: "กลุ่มสาระ (เมนู)", title: "เลือกสำรวจตามกลุ่มสาระ", subtitle: "แตะกลุ่มสาระเพื่อดูสื่อทั้งหมด" },
  latest: { ...base, eyebrow: "มาใหม่", icon: "sparkles", moreHref: "/library?sort=latest", kind: "สื่อล่าสุด (สไลด์แนวข้าง)", title: "สื่อล่าสุด" },
  popular: { ...base, eyebrow: "ยอดนิยม", icon: "heart", moreHref: "/library?sort=views", kind: "สื่อที่ถูกดูมากที่สุด (สไลด์แนวข้าง)", title: "ดูมากที่สุด", subtitle: "สื่อที่ถูกเปิดดูมากในช่วง 30 วันที่ผ่านมา" },
  courses: { ...base, eyebrow: "เรียนรู้", icon: "play-circle", kind: "คอร์สเรียน", title: "คอร์สเรียน" },
  schools: { ...base, eyebrow: "ทำเนียบ", icon: "users", moreHref: "/schools", moreDefault: false, kind: "ทำเนียบโรงเรียน (Anywhere Anytime)", title: "Anywhere Anytime ของโรงเรียนในเขต", subtitle: "สุ่มโรงเรียนมาให้ชมทุกครั้งที่เข้าเว็บ" },
  resources: { ...base, eyebrow: "แหล่งความรู้", icon: "globe", moreHref: "/resources", kind: "แหล่งสื่อภายนอก (ทำเนียบเว็บ)", title: "แหล่งสื่อภายนอกที่แนะนำ", subtitle: "เว็บไซต์และช่องทางที่คัดมาให้ครูและนักเรียน" },
};

const isOneOf = <T extends readonly string[]>(list: T, v: string): v is T[number] => (list as readonly string[]).includes(v);

/** All sections in display order: saved settings merged over the defaults. */
export async function getHomeSections(): Promise<HomeSectionConfig[]> {
  const rows = new Map((await db.homeSection.findMany()).map((r) => [r.key, r]));

  return SECTION_KEYS.map((key, i) => {
    const d = DEFAULTS[key];
    const r = rows.get(key);
    const more = (on: boolean | null | undefined) => {
      const show = on ?? d.moreDefault ?? true;
      return { hasMore: d.moreHref !== null, showMore: show, moreHref: show ? d.moreHref : null };
    };
    if (!r) return { ...d, key, sortOrder: i, headingStyle: "accent" as const, accentColor: BRAND_ACCENT, ...more(null) };

    // Rows saved before background modes existed only had a colour: treat that as "solid".
    const mode = isOneOf(BG_MODES, r.bgMode) ? r.bgMode : "none";
    return {
      key,
      kind: d.kind,
      title: r.title,
      subtitle: r.subtitle,
      visible: r.visible,
      sortOrder: r.sortOrder,
      align: isOneOf(ALIGNS, r.align) ? r.align : d.align,
      titleSize: isOneOf(SIZES, r.titleSize) ? r.titleSize : d.titleSize,
      titleColor: r.titleColor,
      bgMode: mode === "none" && r.bgColor ? "solid" : mode,
      bgColor: r.bgColor,
      bgColor2: r.bgColor2,
      bgDirection: isOneOf(DIRECTION_VALUES, r.bgDirection) ? r.bgDirection : "to right",
      bgImageUrl: fileUrl(r.bgImageKey),
      bgOverlay: r.bgOverlay,
      headingStyle: isOneOf(HEADING_STYLES, r.headingStyle) ? r.headingStyle : "accent",
      eyebrow: r.eyebrow ?? d.eyebrow,
      accentColor: r.accentColor ?? BRAND_ACCENT,
      icon: d.icon,
      ...more(r.showMore),
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder || SECTION_KEYS.indexOf(a.key) - SECTION_KEYS.indexOf(b.key));
}
