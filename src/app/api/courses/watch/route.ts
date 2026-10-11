import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reportWatchAs } from "@/lib/course/course-learn";

export const dynamic = "force-dynamic";

/**
 * The player reports the stretches of a video it really played. A route (not a server action) so the browser can also
 * send it while the page is closing (fetch with keepalive). 429 = "too often, keep these and try later".
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { blockId?: unknown; durationSec?: unknown; segments?: unknown } | null;
  if (!body || typeof body.blockId !== "string" || typeof body.durationSec !== "number" || !Array.isArray(body.segments)) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const segments = body.segments.filter((s): s is [number, number] => Array.isArray(s) && s.length === 2 && typeof s[0] === "number" && typeof s[1] === "number");
  const r = await reportWatchAs(session.user.id, body.blockId, { durationSec: body.durationSec, segments });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.error.includes("บ่อยเกินไป") ? 429 : 400 });
  return NextResponse.json({ percent: r.percent, lessonDone: r.lessonDone, progress: r.progress, complete: r.complete });
}
