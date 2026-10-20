import { createHash } from "node:crypto";
import { getSiteInfo, type SiteInfo } from "@/lib/site";
import { plainText } from "@/lib/site-texts";

/** What the installed app is called, taken from the admin's site settings so every district gets its own name and icon. */
export type PwaIdentity = {
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  /** Changes whenever the logo or colour changes, so browsers refetch the generated icons. */
  iconVersion: string;
  hasLogo: boolean;
};

export const iconUrl = (name: string, id: PwaIdentity) => `/pwa-icon/${name}?v=${id.iconVersion}`;

export function pwaIdentityOf(site: SiteInfo): PwaIdentity {
  const name = plainText(site.systemName) || "Anywhere Anytime";
  const area = plainText(site.areaName);
  const tagline = plainText(site.tagline);
  return {
    name,
    shortName: [...name].slice(0, 12).join("").trim(),
    description: [tagline, area].filter(Boolean).join(" · ") || name,
    themeColor: site.heroBgColor,
    backgroundColor: site.heroBgColor,
    iconVersion: createHash("sha1").update(`${site.logoUrl ?? "none"}|${site.heroBgColor}|${site.logoBackdrop ? 1 : 0}`).digest("hex").slice(0, 10),
    hasLogo: !!site.logoUrl,
  };
}

export async function getPwaIdentity(): Promise<PwaIdentity> {
  return pwaIdentityOf(await getSiteInfo());
}
