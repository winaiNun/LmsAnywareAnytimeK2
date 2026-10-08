import type { CSSProperties } from "react";

// Pure constants/helpers (no database import) so client components can use them too.
export const ALIGNS = ["left", "center", "right"] as const;
export const SIZES = ["sm", "md", "lg"] as const;
export const BG_MODES = ["none", "solid", "gradient", "image"] as const;

export const DIRECTIONS = [
  { value: "to right", label: "→ ซ้ายไปขวา" },
  { value: "to left", label: "← ขวาไปซ้าย" },
  { value: "to bottom", label: "↓ บนลงล่าง" },
  { value: "to top", label: "↑ ล่างขึ้นบน" },
  { value: "to bottom right", label: "↘ มุมบนซ้ายไปล่างขวา" },
  { value: "to bottom left", label: "↙ มุมบนขวาไปล่างซ้าย" },
  { value: "to top right", label: "↗ มุมล่างซ้ายไปบนขวา" },
  { value: "to top left", label: "↖ มุมล่างขวาไปบนซ้าย" },
] as const;
export const DIRECTION_VALUES = DIRECTIONS.map((d) => d.value) as [string, ...string[]];

export const PALETTE = [
  "#FFFFFF", "#F9F9F9", "#EAF0FF", "#E8F7EF", "#FFF4E5", "#FDECEC", "#F3E8FF", "#E5E7EB",
  "#0052FF", "#0F766E", "#17B26A", "#F59E0B", "#F04438", "#7C3AED", "#475569", "#1E1E1E",
  "#0B2A6F", "#1E3A8A", "#134E4A", "#9F1239", "#B45309", "#4C1D95", "#0F172A", "#000000",
];

export const HEADING_SIZE: Record<(typeof SIZES)[number], string> = {
  sm: "text-xl sm:text-2xl",
  md: "text-2xl sm:text-3xl",
  lg: "text-3xl sm:text-5xl",
};

export const HEADING_ALIGN: Record<(typeof ALIGNS)[number], string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** Relative luminance 0..1 of a #RRGGBB colour. */
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export type BgInput = {
  mode: (typeof BG_MODES)[number];
  color: string | null;
  color2: string | null;
  direction: string;
  imageUrl: string | null;
  overlay: number;
};

/** CSS for a section background + whether text on top should be light or dark. */
export function sectionBackground(b: BgInput): { style: CSSProperties; overlay: number; tone: "light" | "dark" } {
  const c1 = b.color ?? "#FFFFFF";
  const c2 = b.color2 ?? c1;
  switch (b.mode) {
    case "solid":
      return { style: { backgroundColor: c1 }, overlay: 0, tone: luminance(c1) < 0.35 ? "light" : "dark" };
    case "gradient":
      return {
        style: { backgroundImage: `linear-gradient(${b.direction}, ${c1}, ${c2})` },
        overlay: 0,
        tone: (luminance(c1) + luminance(c2)) / 2 < 0.35 ? "light" : "dark",
      };
    case "image":
      if (!b.imageUrl) return { style: {}, overlay: 0, tone: "dark" };
      return {
        style: { backgroundImage: `url(${b.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" },
        overlay: b.overlay,
        tone: b.overlay >= 40 ? "light" : "dark",
      };
    default:
      return { style: {}, overlay: 0, tone: "dark" };
  }
}
