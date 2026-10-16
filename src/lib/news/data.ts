/** What the public news pages need. Server only. One cached database read for all tabs, and one cached download per feed. */
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { fetchFeed } from "./fetch";
import { clampPageSize, mergeCards, paginate, type NewsCard } from "./merge";

export type PublicNewsItem = { id: string; kind: "LINK" | "FEED"; title: string; url: string; note: string; date: string; pinned: boolean; feedLimit: number; feedCacheMin: number };
export type PublicNewsTab = { id: string; name: string; pageSize: number; items: PublicNewsItem[] };

/** The shown tabs with their shown items. Cached five minutes and refreshed at once when the admin saves (tag "news"). */
export const getNewsTabs = unstable_cache(
  async (): Promise<PublicNewsTab[]> => {
    const tabs = await db.newsTab.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, pageSize: true, items: { where: { active: true }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, title: true, url: true, note: true, publishedAt: true, createdAt: true, pinned: true, feedLimit: true, feedCacheMin: true } } },
    });
    return tabs.map((t) => ({
      id: t.id,
      name: t.name,
      pageSize: clampPageSize(t.pageSize),
      items: t.items.map((i) => ({ id: i.id, kind: i.kind, title: i.title, url: i.url, note: i.note ?? "", date: (i.publishedAt ?? i.createdAt).toISOString(), pinned: i.pinned, feedLimit: i.feedLimit, feedCacheMin: i.feedCacheMin })),
    }));
  },
  ["news-tabs"],
  { revalidate: 300, tags: ["news"] },
);

/** One feed, cached for the minutes the admin chose. A failure is cached just as long, so a dead source does not slow every visit. */
export function getFeedCards(item: PublicNewsItem) {
  const cached = unstable_cache(async () => fetchFeed(item.url), ["news-feed", item.id, item.url], { revalidate: Math.max(15, Math.min(360, item.feedCacheMin)) * 60, tags: ["news", `news-feed-${item.id}`] });
  return cached().then((r) => (r.ok ? { ok: true as const, cards: r.feed.entries.slice(0, item.feedLimit).map<NewsCard>((e) => ({ key: `f-${item.id}-${e.link}`, title: e.title, link: e.link, date: e.date, note: e.summary, image: e.image, source: item.title, kind: "FEED", pinned: false })) } : { ok: false as const, error: r.error }));
}

export type NewsPage = { tab: { id: string; name: string; pageSize: number }; items: NewsCard[]; page: number; pages: number; total: number; failed: string[] };

/** One page of one tab: typed links + every feed of the tab, merged and sorted. null = no such (shown) tab. */
export async function getNewsPage(tabId: string, page: unknown): Promise<NewsPage | null> {
  const tab = (await getNewsTabs()).find((t) => t.id === tabId);
  if (!tab) return null;
  const manual = tab.items.filter((i) => i.kind === "LINK").map<NewsCard>((i) => ({ key: `l-${i.id}`, title: i.title, link: i.url, date: i.date, note: i.note, image: null, source: "", kind: "LINK", pinned: i.pinned }));
  const feeds = tab.items.filter((i) => i.kind === "FEED");
  const results = await Promise.all(feeds.map(async (f) => ({ f, r: await getFeedCards(f) })));
  const paged = paginate(mergeCards(manual, results.flatMap((x) => (x.r.ok ? x.r.cards : []))), page, tab.pageSize);
  return { tab: { id: tab.id, name: tab.name, pageSize: tab.pageSize }, ...paged, failed: results.filter((x) => !x.r.ok).map((x) => x.f.title) };
}

/** Wait for `promise` at most `ms`; null when it is too slow (the caller shows a loading frame and lets the browser ask again). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}
