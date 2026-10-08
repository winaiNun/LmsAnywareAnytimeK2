"use server";

import { driveViewUrl } from "@/lib/drive";
import { fetchDriveImage } from "@/lib/drive-fetch";
import { assertRole, canAuthor } from "@/lib/permissions";

export type DrivePreview =
  | { ok: true; id: string; dataUrl: string; mime: string; width: number; height: number; bytes: number; viewUrl: string }
  | { ok: false; error: string };

/**
 * Step 1 of "image from Google Drive": download the public thumbnail so the browser can show it in the
 * crop dialog. (The fetching and its safety checks live in `src/lib/drive-fetch.ts`.)
 */
export async function fetchDriveThumbnail(link: string): Promise<DrivePreview> {
  await assertRole(canAuthor);
  const img = await fetchDriveImage(link, 1800);
  if (!img.ok) return img;
  return {
    ok: true,
    id: img.id,
    dataUrl: `data:${img.mime};base64,${img.buffer.toString("base64")}`,
    mime: img.mime,
    width: img.width,
    height: img.height,
    bytes: img.buffer.length,
    viewUrl: driveViewUrl(img.id),
  };
}
