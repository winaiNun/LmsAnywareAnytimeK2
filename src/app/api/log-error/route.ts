import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logError } from "@/lib/error-log";
import { clientIp, rateLimited } from "@/lib/rate-limit";

/** Browsers report a page that broke. Open to everyone (a broken page may be a sign-in page) but small, rate limited and scrubbed. */
export async function POST(req: Request) {
  // in-memory limiter on purpose: a flood of reports must cost the database nothing (the database one writes a row per call)
  if (rateLimited(`log-error:${clientIp(req)}`, 30, 10 * 60 * 1000)) return new NextResponse(null, { status: 204 });
  const raw = await req.text();
  if (raw.length > 8000) return new NextResponse(null, { status: 204 });
  let b: Record<string, unknown>;
  try {
    b = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const message = str(b.message, 400);
  if (!message) return new NextResponse(null, { status: 204 });
  const session = await getServerSession(authOptions).catch(() => null);
  await logError({
    source: b.source === "boundary" ? "boundary" : "client",
    message,
    stack: str(b.stack, 2000) || null,
    path: str(b.path, 300) || "/",
    digest: str(b.digest, 60) || null,
    userId: session?.user?.id ?? null,
  });
  return new NextResponse(null, { status: 204 });
}
