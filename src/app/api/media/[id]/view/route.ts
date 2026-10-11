import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordView } from "@/lib/media-counters";
import { clientIp, rateLimited } from "@/lib/rate-limit";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor/i;

/** Called by the browser after the media page has loaded (so crawlers and link previews that only fetch HTML are not counted). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (BOT.test(req.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
  if (rateLimited(`mv:${clientIp(req)}:${params.id}`, 1, 5 * 60 * 1000)) return new Response(null, { status: 204 }); // best effort; the browser also remembers for 6 hours

  const session = await getServerSession(authOptions);
  if (session) {
    const owns = await db.media.findFirst({ where: { id: params.id, createdById: session.user.id }, select: { id: true } });
    if (owns) return new Response(null, { status: 204 }); // an owner reloading their own page is not a view
  }
  await recordView(params.id);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
