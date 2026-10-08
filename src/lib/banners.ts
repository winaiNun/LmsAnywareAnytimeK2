import { db } from "@/lib/db";
import { fileUrl } from "@/lib/site";
import { DEFAULT_SLIDESHOW, EFFECT_VALUES, type SlideshowConfig } from "@/lib/slideshow";

export type PublicBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  newTab: boolean;
  pinned: boolean;
  buttonText: string | null;
  bgColor: string;
  showText: boolean;
};

export const bannerImageUrl = fileUrl;

/** Active banners inside their schedule window, in display order. */
export async function getActiveBanners(): Promise<PublicBanner[]> {
  const now = new Date();
  const rows = await db.banner.findMany({
    where: {
      active: true,
      published: true,
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    },
    orderBy: [{ pinned: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: bannerImageUrl(b.imageKey),
    linkUrl: b.linkUrl,
    newTab: b.newTab,
    pinned: b.pinned,
    buttonText: b.buttonText,
    bgColor: b.bgColor,
    showText: b.showText,
  }));
}

export async function getSlideshowConfig(): Promise<SlideshowConfig> {
  const s = await db.siteSetting.findUnique({ where: { id: "main" } });
  if (!s) return DEFAULT_SLIDESHOW;
  return {
    radius: s.slideRadius,
    effect: (EFFECT_VALUES as readonly string[]).includes(s.slideEffect) ? (s.slideEffect as SlideshowConfig["effect"]) : DEFAULT_SLIDESHOW.effect,
    intervalSec: s.slideInterval,
    layout: s.slideLayout === "full" ? "full" : "contained",
    autoplay: s.slideAutoplay,
    arrows: s.slideArrows,
    randomEffect: s.slideRandom,
    shuffle: s.slideShuffle,
  };
}

/** Pinned slides first (in saved order); the rest optionally shuffled. */
export function orderForDisplay(banners: PublicBanner[], shuffle: boolean): PublicBanner[] {
  if (!shuffle) return banners;
  const pinned = banners.filter((b) => b.pinned);
  const rest = banners.filter((b) => !b.pinned);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...pinned, ...rest];
}
