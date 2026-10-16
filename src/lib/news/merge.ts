/** Putting the entries of one tab together: pure functions, no network, no database. */

export type NewsCard = {
  key: string;
  title: string;
  link: string;
  date: string | null; // ISO
  note: string; // LINK: the admin's line; FEED: the entry summary
  image: string | null;
  source: string; // the feed name, or "" for a hand-typed link
  kind: "LINK" | "FEED";
  pinned: boolean;
};

export const MIN_PAGE_SIZE = 3;
export const MAX_PAGE_SIZE = 30;
export const DEFAULT_PAGE_SIZE = 8;
export const MAX_TABS = 12; // tabs the admin may create
export const MAX_ITEMS = 300; // items (links + feeds) in total

export const clampPageSize = (n: unknown): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, v)) : DEFAULT_PAGE_SIZE;
};

/** The same article reached by two addresses counts once: host in lower case, no #fragment, no utm_* tracking, no trailing slash. */
export function linkKey(link: string): string {
  try {
    const u = new URL(link);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k) || k === "fbclid") u.searchParams.delete(k);
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return link;
  }
}

const time = (d: string | null) => (d ? Date.parse(d) : Number.NEGATIVE_INFINITY);

/**
 * Hand-typed links first win a duplicate; pinned links sit at the top (newest first among them); everything else is newest first,
 * entries without a readable date last. The sort is stable, so equal dates keep their given order.
 */
export function mergeCards(manual: NewsCard[], fromFeeds: NewsCard[]): NewsCard[] {
  const seen = new Set<string>();
  const all: NewsCard[] = [];
  for (const c of [...manual, ...fromFeeds]) {
    const k = linkKey(c.link);
    if (seen.has(k)) continue;
    seen.add(k);
    all.push(c);
  }
  return all
    .map((c, i) => ({ c, i }))
    .sort((a, b) => Number(b.c.pinned) - Number(a.c.pinned) || time(b.c.date) - time(a.c.date) || a.i - b.i)
    .map((x) => x.c);
}

export type Paged<T> = { items: T[]; page: number; pages: number; total: number };

/** Page numbers start at 1; one that is out of range (or not a number) is pulled back into range. */
export function paginate<T>(list: T[], page: unknown, pageSize: number): Paged<T> {
  const size = clampPageSize(pageSize);
  const pages = Math.max(1, Math.ceil(list.length / size));
  const wanted = Math.floor(Number(page));
  const p = Number.isFinite(wanted) ? Math.min(pages, Math.max(1, wanted)) : 1;
  return { items: list.slice((p - 1) * size, p * size), page: p, pages, total: list.length };
}
