import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

// name -> [pixel size, share of the square the logo may fill]. Maskable icons keep the logo inside the safe zone.
const VARIANTS: Record<string, [number, number]> = {
  "192": [192, 0.8],
  "512": [512, 0.8],
  "maskable-192": [192, 0.6],
  "maskable-512": [512, 0.6],
  "apple-180": [180, 0.8],
};

/** Home-screen icons built from the district's own logo (falls back to the stock icon when no logo is set). */
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const variant = VARIANTS[params.name];
  if (!variant) return new Response("Not found", { status: 404 });
  const [size, fill] = variant;
  const s = await db.siteSetting.findUnique({ where: { id: "main" }, select: { logoKey: true, logoBackdrop: true, heroBgColor: true } });
  const headers = { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" };

  if (s?.logoKey) {
    try {
      const logo = await getStorage().get(s.logoKey);
      const inner = Math.round(size * fill);
      const resized = await sharp(logo).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const png = await sharp({ create: { width: size, height: size, channels: 4, background: s.logoBackdrop ? "#ffffff" : (s.heroBgColor ?? "#0B2A6F") } })
        .composite([{ input: resized, gravity: "center" }])
        .png()
        .toBuffer();
      return new Response(new Uint8Array(png), { headers });
    } catch {
      // logo file missing or unreadable: use the stock icon below
    }
  }
  const stock = params.name === "apple-180" ? "apple-touch-icon.png" : params.name.startsWith("maskable") ? "maskable-512.png" : "icon-512.png";
  const png = await readFile(path.join(process.cwd(), "public", "icons", stock));
  return new Response(new Uint8Array(png), { headers: { ...headers, "Cache-Control": "public, max-age=300" } });
}
