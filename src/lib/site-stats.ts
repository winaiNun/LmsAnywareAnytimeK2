/**
 * Site-wide visitor counter and "online now" (server only). Nothing personal is stored:
 * visitors are counted once per browser per Bangkok day (a cookie decides, see /api/visit), "online" is a set of
 * random tab ids with a last-seen time.
 */
import { db } from "@/lib/db";
import { bangkokDay } from "@/lib/media-counters";
import { bangkokParts } from "@/lib/thai-date";

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const DAY = 86400000;

/** Crawlers, uptime monitors and command-line fetchers are not visitors. */
export const isBot = (ua: string | null | undefined) => !ua || /bot|crawl|spider|slurp|facebookexternalhit|lighthouse|pingdom|uptime|curl|wget|python-requests|httpclient|monitor/i.test(ua);

/** +1 for today's Bangkok date. One statement, so simultaneous visitors never lose a count. */
export async function recordVisit(now: Date = new Date()): Promise<void> {
  await db.$executeRaw`INSERT INTO "SiteVisitDaily" ("day", "visitors") VALUES (${bangkokDay(now)}::date, 1)
    ON CONFLICT ("day") DO UPDATE SET "visitors" = "SiteVisitDaily"."visitors" + 1`;
}

/** Marks a tab as online right now (and now and then sweeps rows older than a day). */
export async function heartbeat(sid: string, now: Date = new Date()): Promise<void> {
  await db.$executeRaw`INSERT INTO "OnlinePing" ("sid", "seenAt") VALUES (${sid}, ${now}) ON CONFLICT ("sid") DO UPDATE SET "seenAt" = ${now}`;
  if (Math.random() < 0.02) await db.onlinePing.deleteMany({ where: { seenAt: { lt: new Date(now.getTime() - DAY) } } }).catch(() => {});
}

export async function onlineNow(now: Date = new Date()): Promise<number> {
  return db.onlinePing.count({ where: { seenAt: { gte: new Date(now.getTime() - ONLINE_WINDOW_MS) } } });
}

export type VisitStats = { today: number; month: number; total: number; since: string; showVisits: boolean; showOnline: boolean };

/** Today / this month / all time (= starting number + every counted day) and the date counting started. */
export async function getVisitStats(now: Date = new Date()): Promise<VisitStats> {
  const today = bangkokDay(now);
  const p = bangkokParts(now);
  const monthStart = new Date(Date.UTC(p.year, p.month - 1, 1));
  const [site, t, m, all] = await Promise.all([
    db.siteSetting.findUnique({ where: { id: "main" }, select: { counterSince: true, counterBase: true, showVisits: true, showOnline: true } }),
    db.siteVisitDaily.findUnique({ where: { day: today } }),
    db.siteVisitDaily.aggregate({ where: { day: { gte: monthStart } }, _sum: { visitors: true } }),
    db.siteVisitDaily.aggregate({ _sum: { visitors: true } }),
  ]);
  return {
    today: t?.visitors ?? 0,
    month: m._sum.visitors ?? 0,
    total: (site?.counterBase ?? 0) + (all._sum.visitors ?? 0),
    since: (site?.counterSince ?? now).toISOString(),
    showVisits: site?.showVisits ?? true,
    showOnline: site?.showOnline ?? true,
  };
}

/** Visitors per Bangkok day for the last `days` days, oldest first (for the admin dashboard). */
export async function dailyVisitors(days = 14, now: Date = new Date()): Promise<{ day: number; value: number }[]> {
  const to = bangkokDay(now);
  const from = new Date(to.getTime() - (days - 1) * DAY);
  const rows = await db.siteVisitDaily.findMany({ where: { day: { gte: from } } });
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(from.getTime() + i * DAY);
    return { day: d.getUTCDate(), value: rows.find((r) => r.day.getTime() === d.getTime())?.visitors ?? 0 };
  });
}
