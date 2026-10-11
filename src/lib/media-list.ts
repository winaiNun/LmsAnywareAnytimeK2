/** Public listing of published media: search, filters, sort, paging (server only). */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cardSelect, toCard, type MediaCardData } from "@/lib/media-data";
import { topViewedIds } from "@/lib/media-counters";

export const SORTS = ["latest", "views", "likes"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABEL: Record<Sort, string> = { latest: "ล่าสุด", views: "ดูมากสุด", likes: "ถูกใจมากสุด" };
/** 12 divides evenly into every column count the grid uses (1, 2, 3, 4): 4 columns x 3 rows on a desktop, so no half-empty last row. */
export const PER_PAGE = 12;

export type MediaQuery = { q?: string; area?: string; type?: string; level?: string; by?: string; sort?: Sort; page?: number };

export const isSort = (v: unknown): v is Sort => typeof v === "string" && (SORTS as readonly string[]).includes(v);

export async function queryMedia(q: MediaQuery): Promise<{ items: MediaCardData[]; total: number; page: number; pages: number }> {
  const text = q.q?.trim() ?? "";
  const where: Prisma.MediaWhereInput = {
    status: "PUBLISHED",
    ...(q.area && { area: { slug: q.area } }),
    ...(q.type && { type: { slug: q.type } }),
    ...(q.level && { levels: { some: { level: { slug: q.level } } } }),
    ...(q.by && { createdById: q.by, createdBy: { memberType: { not: "STUDENT" } } }), // a minor's media are never listed "by person"
    ...(text && {
      OR: [
        { title: { contains: text, mode: "insensitive" } },
        { description: { contains: text, mode: "insensitive" } },
        { tags: { has: text } },
        { authorName: { contains: text, mode: "insensitive" } },
        { createdBy: { name: { contains: text, mode: "insensitive" }, memberType: { not: "STUDENT" } } },
      ],
    }),
  };
  const sort = q.sort ?? "latest";
  const orderBy: Prisma.MediaOrderByWithRelationInput[] =
    sort === "views" ? [{ viewCount: "desc" }, { publishedAt: "desc" }] : sort === "likes" ? [{ likeCount: "desc" }, { publishedAt: "desc" }] : [{ pinned: "desc" }, { publishedAt: "desc" }];

  const total = await db.media.count({ where });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, q.page ?? 1), pages);
  const rows = await db.media.findMany({ where, orderBy, skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: cardSelect });
  return { items: rows.map(toCard), total, page, pages };
}

/** Newest published media (home page rail). Pinned items come first. */
export async function latestMedia(limit: number): Promise<MediaCardData[]> {
  const rows = await db.media.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }], take: limit, select: cardSelect });
  return rows.map(toCard);
}

/** Most viewed in the last 30 days; topped up with all-time most viewed while there is little recent data. */
export async function popularMedia(limit: number): Promise<MediaCardData[]> {
  const ids = await topViewedIds(limit);
  const recent = ids.length ? await db.media.findMany({ where: { id: { in: ids }, status: "PUBLISHED" }, select: cardSelect }) : [];
  const order = new Map(ids.map((id, i) => [id, i]));
  const picked = recent.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  if (picked.length >= limit) return picked.map(toCard);
  const fill = await db.media.findMany({
    where: { status: "PUBLISHED", id: { notIn: picked.map((p) => p.id) } },
    orderBy: [{ viewCount: "desc" }, { publishedAt: "desc" }],
    take: limit - picked.length,
    select: cardSelect,
  });
  return [...picked, ...fill].map(toCard);
}

/** Counts per learning area for the home menu and the filter chips. */
export async function areaCounts() {
  const areas = await db.learningArea.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true, cardName: true, icon: true, color: true, _count: { select: { media: { where: { status: "PUBLISHED" } } } } },
  });
  return areas.map((a) => ({ id: a.id, slug: a.slug, name: a.name, cardName: a.cardName, icon: a.icon, color: a.color, count: a._count.media }));
}
