import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export type SiteInfo = {
  systemName: string;
  areaName: string;
  tagline: string;
  logoUrl: string | null;
  logoBackdrop: boolean;
  heroVideoUrl: string | null;
  heroImageUrl: string | null;
  heroImageAnimated: boolean;
  heroBgColor: string;
  overlayOpacity: number;
  fadeSeconds: number;
  allowServerUploads: boolean;
  requireRegistrationCode: boolean;
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
    heroImageUrl: fileUrl(s?.heroImageKey ?? null),
    heroImageAnimated: s?.heroImageAnimated ?? false,
    heroBgColor: s?.heroBgColor ?? "#0B2A6F",
    overlayOpacity: s?.overlayOpacity ?? 45,
    fadeSeconds: s?.fadeSeconds ?? 1.5,
    allowServerUploads: s?.allowServerUploads ?? false,
    requireRegistrationCode: s?.requireRegistrationCode ?? true,
  };
}

type AvatarRow = { avatarKey: string | null; avatarDriveId: string | null; avatarCx: number; avatarCy: number; avatarZoom: number; avatarAspect: number };

/** DB columns -> what <Avatar> needs (null when the member has no picture). */
export function avatarOf(u: AvatarRow): import("@/lib/avatar").AvatarData | null {
  if (!u.avatarKey && !u.avatarDriveId) return null;
  return { url: fileUrl(u.avatarKey), driveId: u.avatarDriveId, cx: u.avatarCx, cy: u.avatarCy, zoom: u.avatarZoom, aspect: u.avatarAspect };
}
