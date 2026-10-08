import { db } from "@/lib/db";
import { fileUrl } from "@/lib/site";

export type PublicBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
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
      AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: bannerImageUrl(b.imageKey),
    linkUrl: b.linkUrl,
    buttonText: b.buttonText,
    bgColor: b.bgColor,
    showText: b.showText,
  }));
}
