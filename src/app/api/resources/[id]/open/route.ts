import { db } from "@/lib/db";
import { clientIp, rateLimited } from "@/lib/rate-limit";

/** sendBeacon when someone opens an outside source: counted, never blocks the click. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (rateLimited(`ro:${clientIp(req)}:${params.id}`, 3, 5 * 60 * 1000)) return new Response(null, { status: 204 });
  await db.resourceLink.updateMany({ where: { id: params.id, active: true }, data: { clickCount: { increment: 1 } } });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
