import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimited } from "@/lib/rate-limit";
import { heartbeat, isBot, onlineNow } from "@/lib/site-stats";

export const dynamic = "force-dynamic"; // a GET handler with no request access would otherwise be frozen at build time

const SID = /^[A-Za-z0-9]{8,40}$/;

/** A visible tab says "I'm here" every ~90 s. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { sid?: unknown } | null;
  const sid = typeof body?.sid === "string" ? body.sid : "";
  const none = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (!SID.test(sid) || isBot(req.headers.get("user-agent")) || rateLimited(`hb:${sid}`, 6, 60 * 1000)) return none;
  const site = await db.siteSetting.findUnique({ where: { id: "main" }, select: { showOnline: true } });
  if (site && !site.showOnline) return none;
  await heartbeat(sid);
  return none;
}

let cached: { at: number; value: number | null } | null = null;

/**
 * How many tabs were seen in the last 5 minutes. Remembered for 20 s inside the server instance so a busy site does not
 * hammer the database (browsers get no-store: a shared-cache header made Chrome stall duplicate requests for 30 s).
 */
export async function GET() {
  if (!cached || Date.now() - cached.at > 20_000) {
    const site = await db.siteSetting.findUnique({ where: { id: "main" }, select: { showOnline: true } });
    cached = { at: Date.now(), value: site && !site.showOnline ? null : await onlineNow() };
  }
  return NextResponse.json({ online: cached.value }, { headers: { "Cache-Control": "no-store" } });
}
