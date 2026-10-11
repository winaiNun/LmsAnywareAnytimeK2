import { recordOpen } from "@/lib/media-counters";
import { clientIp, rateLimited } from "@/lib/rate-limit";

/** `navigator.sendBeacon` when someone clicks download / "open the original": counted, never blocks the click. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (rateLimited(`mo:${clientIp(req)}:${params.id}`, 3, 5 * 60 * 1000)) return new Response(null, { status: 204 });
  await recordOpen(params.id);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
