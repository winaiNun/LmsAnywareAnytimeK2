/* Needs the local database: npm run test:db. It saves and restores the visitor tables and the counter settings. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { bangkokDay } from "../src/lib/media-counters";
import { dailyVisitors, getVisitStats, heartbeat, onlineNow, recordVisit } from "../src/lib/site-stats";

const db = new PrismaClient();

async function main() {
  const visits = await db.siteVisitDaily.findMany();
  const pings = await db.onlinePing.findMany();
  const site = await db.siteSetting.findUnique({ where: { id: "main" } });
  try {
    await db.siteVisitDaily.deleteMany();
    await db.onlinePing.deleteMany();
    await db.siteSetting.upsert({ where: { id: "main" }, update: { counterBase: 100, counterSince: new Date("2026-01-05T00:00:00Z"), showVisits: true, showOnline: true }, create: { id: "main", counterBase: 100 } });

    // 1) Bangkok calendar day: 16:59 UTC is still the 11th, 17:00 UTC is already the 12th
    const a = new Date("2026-10-11T16:59:00Z");
    const b = new Date("2026-10-11T17:00:00Z");
    await recordVisit(a);
    await recordVisit(b);
    const rows = await db.siteVisitDaily.findMany({ orderBy: { day: "asc" } });
    assert.deepEqual(rows.map((r) => [r.day.toISOString().slice(0, 10), r.visitors]), [["2026-10-11", 1], ["2026-10-12", 1]]);

    // 2) 30 visits at the same moment: exactly +30 on that one day
    await Promise.all(Array.from({ length: 30 }, () => recordVisit(b)));
    assert.equal((await db.siteVisitDaily.findUniqueOrThrow({ where: { day: bangkokDay(b) } })).visitors, 31);

    // 3) today / this month / total (= starting number + every counted day) and the start date
    const stats = await getVisitStats(b);
    assert.equal(stats.today, 31);
    assert.equal(stats.month, 32);
    assert.equal(stats.total, 132);
    assert.equal(stats.since, "2026-01-05T00:00:00.000Z");
    const nextMonth = await getVisitStats(new Date("2026-11-02T00:00:00Z"));
    assert.equal(nextMonth.month, 0);
    assert.equal(nextMonth.total, 132);

    // 4) the 14-day series ends today and has 14 entries
    const series = await dailyVisitors(14, b);
    assert.equal(series.length, 14);
    assert.equal(series[13].day, 12);
    assert.equal(series[13].value, 31);
    assert.equal(series[12].value, 1);

    // 5) online now = tabs seen in the last 5 minutes; one tab is one row however often it reports
    const now = new Date("2026-10-11T10:00:00Z");
    await heartbeat("tab-a", new Date(now.getTime() - 60_000));
    await heartbeat("tab-a", new Date(now.getTime() - 30_000));
    await heartbeat("tab-b", new Date(now.getTime() - 4 * 60_000));
    await heartbeat("tab-c", new Date(now.getTime() - 6 * 60_000));
    assert.equal(await onlineNow(now), 2);
    assert.equal(await onlineNow(new Date(now.getTime() + 2 * 60_000)), 1);
    assert.equal(await onlineNow(new Date(now.getTime() + 10 * 60_000)), 0);

    console.log("site stats db: 5 groups passed");
  } finally {
    await db.siteVisitDaily.deleteMany();
    await db.onlinePing.deleteMany();
    if (visits.length) await db.siteVisitDaily.createMany({ data: visits });
    if (pings.length) await db.onlinePing.createMany({ data: pings });
    if (site) await db.siteSetting.update({ where: { id: "main" }, data: { counterBase: site.counterBase, counterSince: site.counterSince, showVisits: site.showVisits, showOnline: site.showOnline } });
    else await db.siteSetting.deleteMany({ where: { id: "main" } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
