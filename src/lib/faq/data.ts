import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { fileUrl } from "@/lib/site";
import { MAX_FAQ_ITEMS } from "./store";

export type PublicFaq = { id: string; question: string; answer: string; keywords: string; pinned: boolean };
export type FaqPublicData = { enabled: boolean; logoUrl: string | null; items: PublicFaq[] };

/**
 * Everything the public chat needs: the on/off switch and the active Q&A. Cached for five minutes (and refreshed immediately when the
 * admin saves, tag "faq") so a visitor's question costs no database read.
 */
export const getFaqPublic = unstable_cache(
  async (): Promise<FaqPublicData> => {
    const [setting, items] = await Promise.all([
      db.siteSetting.findUnique({ where: { id: "main" }, select: { faqEnabled: true, logoKey: true } }),
      db.faqItem.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: MAX_FAQ_ITEMS,
        select: { id: true, question: true, answer: true, keywords: true, pinned: true },
      }),
    ]);
    return { enabled: setting?.faqEnabled ?? true, logoUrl: fileUrl(setting?.logoKey ?? null), items };
  },
  ["faq-public"],
  { revalidate: 300, tags: ["faq"] },
);
