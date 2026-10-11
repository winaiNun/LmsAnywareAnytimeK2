import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** An uploaded certificate font, served to the browser so the designer and the print page draw with it. Fonts are not secret; ids cannot be guessed. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const f = await db.certificateFont.findUnique({ where: { id: params.id }, select: { data: true, mime: true } });
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.data), {
    headers: { "Content-Type": f.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
