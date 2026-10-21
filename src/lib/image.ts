import sharp from "sharp";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Crop to a fixed aspect ratio around a focal point (fx, fy in 0..1), then shrink
 * and re-encode as WebP so uploads stay small. Throws if the buffer is not an image.
 */
export async function processCover(
  input: Buffer,
  { aspect = 3, maxWidth = 1800, fx = 0.5, fy = 0.5 }: { aspect?: number; maxWidth?: number; fx?: number; fy?: number } = {},
) {
  const img = sharp(input, { failOn: "error" }).rotate(); // honour EXIF orientation
  const { width = 0, height = 0 } = await sharp(await img.clone().toBuffer()).metadata();
  if (!width || !height) throw new Error("Invalid image");

  let cropW = width;
  let cropH = Math.round(width / aspect);
  if (cropH > height) {
    cropH = height;
    cropW = Math.round(height * aspect);
  }
  const left = clamp(Math.round(fx * width - cropW / 2), 0, width - cropW);
  const top = clamp(Math.round(fy * height - cropH / 2), 0, height - cropH);

  return img
    .extract({ left, top, width: cropW, height: cropH })
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/** A picture the browser already cropped (any ratio): honour EXIF, bound the size, WebP. Throws if the buffer is not an image. */
export async function processPicture(input: Buffer, maxWidth = 1280) {
  return sharp(input, { failOn: "error" }).rotate().resize({ width: maxWidth, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
}

/** Logos keep their own shape (no crop); just bound the size, keep transparency. */
export async function processLogo(input: Buffer, max = 512) {
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
}

/** Section background photos: no crop (the admin already cropped), just standardise size and format. */
export async function processBackground(input: Buffer, maxWidth = 1920) {
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
}

/** Profile pictures: centre-square, bounded size, WebP. (The browser already cropped; this guards against odd uploads.) */
export async function processAvatar(input: Buffer, size = 512) {
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: size, height: size, fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toBuffer();
}

/**
 * Hero background picture. A still (already cropped in the browser) is only standardised. A GIF is
 * not cropped in the browser (a canvas would freeze it), so it is converted here to an animated
 * WebP: same motion, a fraction of the size, and every browser plays it from a plain <img>.
 */
export async function processHeroImage(input: Buffer, { animated, maxWidth = 1920 }: { animated: boolean; maxWidth?: number }) {
  if (!animated) {
    return { data: await sharp(input, { failOn: "error" }).rotate().resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(), animated: false };
  }
  const meta = await sharp(input, { failOn: "error", animated: true }).metadata();
  const pages = meta.pages ?? 1;
  if (pages > 400) throw new Error("Too many frames");
  const data = await sharp(input, { failOn: "error", animated: true })
    .resize({ width: Math.min(maxWidth, 1280), withoutEnlargement: true }) // animated frames are heavy, cap lower than stills
    .webp({ quality: 70, effort: 4 })
    .toBuffer();
  return { data, animated: pages > 1 };
}
