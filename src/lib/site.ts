import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export type SiteInfo = {
  systemName: string;
  areaName: string;
  tagline: string;
  logoUrl: string | null;
  logoBackdrop: boolean;
  heroVideoUrl: string | null;
  heroBgColor: string;
  overlayOpacity: number;
  fadeSeconds: number;
};

/** URL for a stored file: straight from the CDN/public bucket when configured, else via /api/files. */
export const fileUrl = (key: string | null) => (key ? (getStorage().publicUrl?.(key) ?? `/api/files/${key}`) : null);

export async function getSiteInfo(): Promise<SiteInfo> {
  const s = await db.siteSetting.findUnique({ where: { id: "main" } });
  return {
    systemName: s?.systemName ?? "Anyware Anytime",
    areaName: s?.areaName ?? "",
    tagline: s?.tagline ?? "",
    logoUrl: fileUrl(s?.logoKey ?? null),
    logoBackdrop: s?.logoBackdrop ?? false,
    heroVideoUrl: fileUrl(s?.heroVideoKey ?? null),
    heroBgColor: s?.heroBgColor ?? "#0B2A6F",
    overlayOpacity: s?.overlayOpacity ?? 45,
    fadeSeconds: s?.fadeSeconds ?? 1.5,
  };
}
