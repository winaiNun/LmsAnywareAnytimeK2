import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { resolveTexts, type SiteTexts } from "@/lib/site-texts";

/** The effective menu names / page headings (defaults + the admin's edits). Cached for a minute and refreshed on save (tag "texts"). */
export const getSiteTexts = unstable_cache(
  async (): Promise<SiteTexts> => {
    const row = await db.siteSetting.findUnique({ where: { id: "main" }, select: { texts: true } });
    return resolveTexts(row?.texts);
  },
  ["site-texts"],
  { revalidate: 60, tags: ["texts"] },
);
