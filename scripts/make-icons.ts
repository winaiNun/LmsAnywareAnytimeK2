// Regenerates the PWA / favicon icons from one drawing:  npx tsx scripts/make-icons.ts
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const star = (cx: number, cy: number, r: number, fill: string) =>
  `<path d="M${cx} ${cy - r}C${cx + r * 0.12} ${cy - r * 0.22} ${cx + r * 0.22} ${cy - r * 0.12} ${cx + r} ${cy}C${cx + r * 0.22} ${cy + r * 0.12} ${cx + r * 0.12} ${cy + r * 0.22} ${cx} ${cy + r}C${cx - r * 0.12} ${cy + r * 0.22} ${cx - r * 0.22} ${cy + r * 0.12} ${cx - r} ${cy}C${cx - r * 0.22} ${cy - r * 0.12} ${cx - r * 0.12} ${cy - r * 0.22} ${cx} ${cy - r}Z" fill="${fill}"/>`;

// the artwork lives in a 512 box; `scale` shrinks it toward the centre (maskable icons need a safe zone)
const art = (scale: number) => `
<g transform="translate(256 262) scale(${scale}) translate(-256 -262)">
  <path d="M256 196C216 168 160 162 104 176V348C160 334 216 340 256 368Z" fill="#fff"/>
  <path d="M256 196C296 168 352 162 408 176V348C352 334 296 340 256 368Z" fill="#E6EEFF"/>
  <path d="M104 352C160 338 216 344 256 372C296 344 352 338 408 352" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
  <g stroke="#9DB8F5" stroke-width="9" stroke-linecap="round" fill="none">
    <path d="M138 214C170 210 200 214 226 228"/><path d="M138 248C170 244 200 248 226 262"/><path d="M138 282C170 278 200 282 226 296"/>
    <path d="M374 214C342 210 312 214 286 228"/><path d="M374 248C342 244 312 248 286 262"/><path d="M374 282C342 278 312 282 286 296"/>
  </g>
  ${star(256, 118, 46, "#FFC93C")}
  ${star(336, 96, 15, "#FFE08A")}
  ${star(184, 100, 11, "#FFE08A")}
</g>`;

const bg = (rx: number) => `
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F7BFF"/><stop offset=".55" stop-color="#0A47D6"/><stop offset="1" stop-color="#0B2A6F"/></linearGradient>
  <radialGradient id="h" cx=".3" cy=".18" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="512" height="512" rx="${rx}" fill="url(#g)"/><rect width="512" height="512" rx="${rx}" fill="url(#h)"/>`;

const svg = (rx: number, scale: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg(rx)}${art(scale)}</svg>`;

const out = "public/icons";
mkdirSync(out, { recursive: true });
const png = (s: string, size: number, file: string) => sharp(Buffer.from(s)).resize(size, size).png({ compressionLevel: 9 }).toFile(`${out}/${file}`);

async function main() {
  const rounded = svg(112, 1); // "any": rounded tile, transparent corners
  const full = svg(0, 1); // iOS rounds it itself — must be opaque
  const maskable = svg(0, 0.72); // Android crops to a circle/squircle: keep art inside the 80% safe zone
  for (const n of [48, 72, 96, 128, 144, 152, 192, 256, 384, 512]) await png(rounded, n, `icon-${n}.png`);
  await png(maskable, 512, "maskable-512.png");
  await png(maskable, 192, "maskable-192.png");
  await png(full, 180, "apple-touch-icon.png");
  await png(full, 167, "apple-touch-icon-167.png");
  await png(full, 152, "apple-touch-icon-152.png");
  await png(full, 120, "apple-touch-icon-120.png");
  writeFileSync(`${out}/icon.svg`, rounded);
  // favicon.ico = PNG-in-ICO with 16/32/48
  const sizes = [16, 32, 48];
  const imgs = await Promise.all(sizes.map((n) => sharp(Buffer.from(rounded)).resize(n, n).png().toBuffer()));
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const dirs = imgs.map((b, i) => { const d = Buffer.alloc(16); d[0] = sizes[i]; d[1] = sizes[i]; d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6); d.writeUInt32LE(b.length, 8); d.writeUInt32LE(offset, 12); offset += b.length; return d; });
  writeFileSync("src/app/favicon.ico", Buffer.concat([head, ...dirs, ...imgs]));
  console.log("icons written");
}
main();
