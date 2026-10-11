import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bangkokDay } from "@/lib/media-counters";
import { clientIp } from "@/lib/rate-limit";
import { rateLimitedDb } from "@/lib/rate-limit-db";
import { isBot, recordVisit } from "@/lib/site-stats";

const BANGKOK_OFFSET = 7 * 3600 * 1000;

/**
 * One unique visitor per browser per Bangkok day: the cookie holds today's date, so only the first call of the day counts.
 * No id, no IP and no profile is stored, only the day's total goes up.
 */
export async function POST(req: Request) {
  const today = bangkokDay().toISOString().slice(0, 10);
  const done = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (isBot(req.headers.get("user-agent"))) return done();
  if (req.headers.get("cookie")?.split(/;\s*/).includes(`lms_v=${today}`)) return done();

  const site = await db.siteSetting.findUnique({ where: { id: "main" }, select: { showVisits: true } });
  if (site && !site.showVisits) return done();
  if (await rateLimitedDb(`visit:${clientIp(req)}`, 30, 60 * 60 * 1000)) return done(); // one address opening many "new" browsers

  await recordVisit();
  const res = done();
  const secondsLeft = Math.max(60, Math.ceil((86400000 - ((Date.now() + BANGKOK_OFFSET) % 86400000)) / 1000)); // until Bangkok midnight
  res.cookies.set("lms_v", today, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: secondsLeft });
  return res;
}
