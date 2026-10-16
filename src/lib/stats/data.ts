import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { computeStats } from "./compute";
import { MAX_STAT_CARDS, isStatMetric, statIcon, statLabel, type StatMetric } from "./metrics";

export type StatCardData = { id: string; metric: StatMetric; label: string; icon: string; value: number };

/**
 * The shown cards with their numbers, in ONE cached call: the page costs no database time, and the few COUNT queries run at most
 * every ten minutes (so a new member or media shows up within ten minutes). Editing the cards in the admin refreshes it at once (tag "stats").
 */
export const getStatCards = unstable_cache(
  async (): Promise<StatCardData[]> => {
    const rows = await db.statCard.findMany({ where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: MAX_STAT_CARDS });
    const cards = rows.filter((r) => isStatMetric(r.metric));
    const values = await computeStats(cards.map((r) => r.metric as StatMetric));
    return cards.map((r) => ({ id: r.id, metric: r.metric as StatMetric, label: statLabel(r), icon: statIcon(r), value: values[r.metric] ?? 0 }));
  },
  ["stat-cards"],
  { revalidate: 600, tags: ["stats"] },
);
