import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getVisitStats } from "@/lib/site-stats";
import { getSiteInfo } from "@/lib/site";

/** Everything the footer shows. Cached for a minute (and refreshed when the admin edits links or settings) so the footer costs almost no database time. */
export const getFooterData = unstable_cache(
  async () => {
    const [site, row, resources, stats] = await Promise.all([
      getSiteInfo(),
      db.siteSetting.findUnique({ where: { id: "main" }, select: { contactAddress: true, contactPhone: true, contactEmail: true, facebookUrl: true, youtubeUrl: true, lineUrl: true } }),
      db.resourceLink.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 6, select: { id: true, name: true, url: true } }),
      getVisitStats(),
    ]);
    return {
      site: { systemName: site.systemName, areaName: site.areaName, tagline: site.tagline, logoUrl: site.logoUrl },
      contact: { address: row?.contactAddress ?? null, phone: row?.contactPhone ?? null, email: row?.contactEmail ?? null },
      social: { facebook: row?.facebookUrl ?? null, youtube: row?.youtubeUrl ?? null, line: row?.lineUrl ?? null },
      resources,
      stats,
    };
  },
  ["footer-data"],
  { revalidate: 60, tags: ["footer"] },
);
