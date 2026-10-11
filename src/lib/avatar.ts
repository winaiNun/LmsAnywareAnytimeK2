import { driveThumbnailUrl } from "@/lib/drive";

/** What the UI needs to draw a member's round profile picture. Safe for server and client. */
export type AvatarData = {
  url: string | null; // uploaded square (public file URL)
  driveId: string | null;
  cx: number;
  cy: number;
  zoom: number;
  aspect: number;
};

export const AVATAR_OUT = 512; // uploaded avatars are stored as 512x512 WebP
export const MAX_ZOOM = 4;

/**
 * Where the image sits inside a square viewport, as CSS percentages of that square.
 * The visible window is a square of side min(w,h)/zoom (natural px) centred on (cx,cy) in 0..1 image coordinates;
 * `aspect` = w/h lets us do this with plain CSS and no client-side measuring (so it renders on the server too).
 */
export function avatarBox({ cx, cy, zoom, aspect }: Pick<AvatarData, "cx" | "cy" | "zoom" | "aspect">) {
  const dw = aspect >= 1 ? zoom * aspect : zoom;
  const dh = aspect >= 1 ? zoom : zoom / aspect;
  return { width: `${dw * 100}%`, height: `${dh * 100}%`, left: `${(0.5 - cx * dw) * 100}%`, top: `${(0.5 - cy * dh) * 100}%` };
}

/** Keep the crop window inside the image. */
export function clampCenter(cx: number, cy: number, zoom: number, aspect: number) {
  const dw = aspect >= 1 ? zoom * aspect : zoom;
  const dh = aspect >= 1 ? zoom : zoom / aspect;
  const hx = 0.5 / dw; // half window width as a fraction of image width
  const hy = 0.5 / dh;
  return { cx: Math.min(1 - hx, Math.max(hx, cx)), cy: Math.min(1 - hy, Math.max(hy, cy)) };
}

/** Small avatars ask Drive for a small thumbnail (a page of 20 cards must not pull 20 big images). */
export const driveAvatarSrc = (id: string, px = 800) => driveThumbnailUrl(id, px <= 48 ? 160 : px <= 128 ? 320 : 800);
