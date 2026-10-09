// One-off: renders the PWA icons into public/icons. Run: node scripts/make-icons.mjs
import sharp from "sharp";

// Open book glyph, centred, on the brand gradient. `pad` keeps it inside the maskable safe zone.
const svg = (size, pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F8BFF"/><stop offset="1" stop-color="#0B2A6F"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${pad}) translate(-256 -256)" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round">
    <path d="M256 150c-34-24-78-34-124-30v206c46-4 90 6 124 30 34-24 78-34 124-30V120c-46-4-90 6-124 30z"/>
    <path d="M256 150v206"/>
  </g></svg>`;

const out = async (name, size, pad) => sharp(Buffer.from(svg(size, pad))).png().toFile(`public/icons/${name}`);
await out("icon-192.png", 192, 1);
await out("icon-512.png", 512, 1);
await out("maskable-512.png", 512, 0.78);
await out("apple-touch-icon.png", 180, 0.9);
console.log("ok");
