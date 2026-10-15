import assert from "node:assert/strict";
import sharp from "sharp";
import { processHeroImage } from "../src/lib/image";

async function makeGif(frames: number, w = 1600, h = 900) {
  const bufs: Buffer[] = [];
  for (let i = 0; i < frames; i++) bufs.push(await sharp({ create: { width: w, height: h, channels: 3, background: { r: (i * 50) % 255, g: 90, b: 200 } } }).raw().toBuffer());
  return sharp(Buffer.concat(bufs), { raw: { width: w, height: h * frames, channels: 3, pageHeight: h } }).gif({ delay: Array(frames).fill(100), loop: 0 }).toBuffer();
}

(async () => {
  // GIF stays animated, is capped at 1280 px wide and keeps every frame
  const gif = await makeGif(5);
  const a = await processHeroImage(gif, { animated: true });
  const am = await sharp(a.data, { animated: true }).metadata();
  assert.equal(a.animated, true);
  assert.equal(am.format, "webp");
  assert.equal(am.pages, 5);
  assert.equal(am.width, 1280);
  console.log("ok gif -> animated webp", gif.length, "->", a.data.length, "bytes");

  // a one-frame GIF is reported as not animated
  const one = await processHeroImage(await makeGif(1), { animated: true });
  assert.equal(one.animated, false);
  console.log("ok single-frame gif");

  // still image: re-encoded as WebP, capped at 1920
  const png = await sharp({ create: { width: 3000, height: 1688, channels: 3, background: "#123456" } }).png().toBuffer();
  const s = await processHeroImage(png, { animated: false });
  const sm = await sharp(s.data).metadata();
  assert.equal(sm.format, "webp");
  assert.equal(sm.width, 1920);
  assert.equal(s.animated, false);
  console.log("ok still image");

  // garbage is rejected, too many frames is rejected
  await assert.rejects(() => processHeroImage(Buffer.from("not an image"), { animated: true }));
  const many = await makeGif(401, 16, 9);
  await assert.rejects(() => processHeroImage(many, { animated: true }), /frames/i);
  console.log("ok rejects bad input");
})();
