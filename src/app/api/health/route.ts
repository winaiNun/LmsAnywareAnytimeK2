import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * For an uptime monitor (e.g. UptimeRobot, free): 200 when the site and its database answer, 503 when the database does not.
 * Says nothing about the system beyond that (no versions, no counts), so it is safe to leave open.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true, ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const HEAD = async () => new NextResponse(null, { status: (await GET()).status, headers: { "Cache-Control": "no-store" } });
