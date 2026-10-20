/** Honours page data (server only). Rules and ordering live in honors-rank.ts; this file only loads and shapes rows. */
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { AvatarData } from "@/lib/avatar";
import {
  ELIGIBLE_WHERE,
  academicYearStart,
  honorBadges,
  isHonorEligible,
  rankHonors,
  shuffled,
  type HonorPeriod,
  type HonorTab,
} from "@/lib/honors-rank";
import { avatarOf } from "@/lib/site";

/** Everything the public may see about one member: only what that member chose to show. No e-mail, phone or school account data. */
export type HonorMember = {
  id: string;
  name: string;
  avatar: AvatarData | null;
  position: string | null;
  subtitle: string | null; // school or agency
  bio: string | null;
  mediaCount: number;
  courseCount: number;
  likes: number;
  views: number;
  joinedAt: string; // ISO
  badges: { key: string; label: string }[];
};

const select = {
  id: true,
  name: true,
  memberType: true,
  role: true,
  active: true,
  showInHonors: true,
  honorsHidden: true,
  honorsShowPhoto: true,
  honorsShowSchool: true,
  honorsBio: true,
  position: true,
  organization: true,
  createdAt: true,
  avatarKey: true,
  avatarDriveId: true,
  avatarCx: true,
  avatarCy: true,
  avatarZoom: true,
  avatarAspect: true,
  memberSchool: { select: { name: true } },
  school: { select: { id: true } },
} as const;

export async function loadHonorMembers(period: HonorPeriod): Promise<HonorMember[]> {
  const users = await db.user.findMany({ where: ELIGIBLE_WHERE, select });
  const ok = users.filter((u) => isHonorEligible({ ...u, managesSchool: !!u.school })); // second, independent check of the same rule
  if (ok.length === 0) return [];
  const ids = ok.map((u) => u.id);
  const since = period === "year" ? academicYearStart(new Date()) : null;
  const when = since ? { publishedAt: { gte: since } } : {};
  const [media, courses] = await Promise.all([
    db.media.groupBy({ by: ["createdById"], where: { createdById: { in: ids }, status: "PUBLISHED", ...when }, _count: { _all: true }, _sum: { likeCount: true, viewCount: true } }),
    db.course.groupBy({ by: ["createdById"], where: { createdById: { in: ids }, status: "PUBLISHED", ...when }, _count: { _all: true } }),
  ]);
  const m = new Map(media.map((r) => [r.createdById, r]));
  const c = new Map(courses.map((r) => [r.createdById, r._count._all]));
  return ok.map((u) => {
    const mm = m.get(u.id);
    const mediaCount = mm?._count._all ?? 0;
    const courseCount = c.get(u.id) ?? 0;
    const likes = mm?._sum.likeCount ?? 0;
    return {
      id: u.id,
      name: u.name,
      avatar: u.honorsShowPhoto ? avatarOf(u) : null,
      position: u.honorsShowSchool ? u.position : null,
      subtitle: u.honorsShowSchool ? (u.memberSchool?.name ?? u.organization ?? null) : null,
      bio: u.honorsBio,
      mediaCount,
      courseCount,
      likes,
      views: mm?._sum.viewCount ?? 0,
      joinedAt: u.createdAt.toISOString(),
      badges: honorBadges({ mediaCount, courseCount, likes }),
    };
  });
}

const cached = (period: HonorPeriod) => unstable_cache(() => loadHonorMembers(period), ["honors", period], { revalidate: 300, tags: ["honors"] })();

const settings = async () => {
  const s = await db.siteSetting.findUnique({ where: { id: "main" }, select: { honorsEnabled: true, honorsMinItems: true } });
  return { enabled: s?.honorsEnabled ?? true, minItems: s?.honorsMinItems ?? 1 };
};
export const getHonorsSettings = settings;

export const PAGE_SIZE = 12;

export async function getHonorsPage(opts: { tab: HonorTab; period: HonorPeriod; page: number; q?: string }) {
  const { enabled, minItems } = await settings();
  if (!enabled) return { enabled, total: 0, pages: 1, page: 1, rows: [] as HonorMember[], podium: [] as HonorMember[] };
  let rows = rankHonors((await cached(opts.period)).map((r) => ({ ...r, joinedAt: new Date(r.joinedAt) })), opts.tab, { minItems });
  const q = opts.q?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || (r.subtitle ?? "").toLowerCase().includes(q));
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page), pages);
  const out = (r: (typeof rows)[number]): HonorMember => ({ ...r, joinedAt: r.joinedAt.toISOString() });
  return {
    enabled,
    total,
    pages,
    page,
    rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(out),
    podium: opts.tab !== "all" && opts.tab !== "rising" && !q && page === 1 ? rows.slice(0, 3).map(out) : [],
  };
}

/** Random cards for the home page: ranked members only (the page itself lists everyone who agreed). New random order on every visit. */
export async function getHonorsForHome(limit = 12): Promise<HonorMember[]> {
  const { enabled, minItems } = await settings();
  if (!enabled) return [];
  const rows = (await cached("all")).filter((r) => r.mediaCount + r.courseCount >= Math.max(1, minItems));
  return shuffled(rows).slice(0, limit);
}

/** One member's public card, only while they still agree. */
export async function getHonorMember(id: string): Promise<HonorMember | null> {
  const { enabled } = await settings();
  if (!enabled) return null;
  return (await cached("all")).find((r) => r.id === id) ?? null;
}
