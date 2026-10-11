import { db } from "@/lib/db";
import { canPreviewMedia } from "@/lib/media-access";
import { getActor } from "@/lib/media-server";

export const dynamic = "force-dynamic";

/**
 * Serves a pasted HTML application. The response carries `Content-Security-Policy: sandbox allow-scripts`, so even
 * when someone opens this URL directly the page gets an opaque origin: its scripts run, but can not read our
 * cookies, session or any of our data. `frame-ancestors 'self'` stops other websites from framing it.
 */
export async function GET(_req: Request, { params }: { params: { itemId: string } }) {
  const item = await db.mediaItem.findUnique({ where: { id: params.itemId }, select: { kind: true, html: true, media: { select: { status: true, createdById: true, areaId: true } } } });
  if (!item || item.kind !== "HTML" || !item.html) return new Response("Not found", { status: 404 });

  if (item.media.status !== "PUBLISHED") {
    const actor = await getActor();
    if (!canPreviewMedia(actor, item.media)) return new Response("Not found", { status: 404 });
  }

  return new Response(item.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "sandbox allow-scripts allow-popups allow-modals; frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": item.media.status === "PUBLISHED" ? "public, max-age=300" : "private, no-store",
    },
  });
}
