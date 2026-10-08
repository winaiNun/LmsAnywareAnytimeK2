import { db } from "@/lib/db";
import { ALIGNS, BG_MODES, DIRECTION_VALUES, SIZES } from "@/lib/section-styles";
import { fileUrl } from "@/lib/site";

export { ALIGNS, SIZES, BG_MODES, HEADING_ALIGN, HEADING_SIZE } from "@/lib/section-styles";

export const SECTION_KEYS = ["recommended", "categories", "media", "courses"] as const;
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
};

type Defaults = Omit<HomeSectionConfig, "key" | "sortOrder">;
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
};

const DEFAULTS: Record<SectionKey, Defaults> = {
  recommended: { ...base, kind: "สไลด์แนะนำคอร์ส/สื่อ", title: "แนะนำสำหรับคุณ" },
  categories: { ...base, kind: "หมวดหมู่", title: "เลือกสำรวจตามหมวด" },
  media: { ...base, kind: "สื่อการเรียนรู้", title: "สื่อการเรียนรู้" },
  courses: { ...base, kind: "คอร์สเรียน", title: "คอร์สเรียน" },
};

const isOneOf = <T extends readonly string[]>(list: T, v: string): v is T[number] => (list as readonly string[]).includes(v);

/** All sections in display order: saved settings merged over the defaults. */
export async function getHomeSections(): Promise<HomeSectionConfig[]> {
  const rows = new Map((await db.homeSection.findMany()).map((r) => [r.key, r]));

  return SECTION_KEYS.map((key, i) => {
    const d = DEFAULTS[key];
    const r = rows.get(key);
    if (!r) return { ...d, key, sortOrder: i };

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
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder || SECTION_KEYS.indexOf(a.key) - SECTION_KEYS.indexOf(b.key));
}
