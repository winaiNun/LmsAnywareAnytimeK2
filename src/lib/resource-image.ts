import type { AvatarData } from "@/lib/avatar";
import { fileUrl } from "@/lib/site";

type Row = { iconKey: string | null; iconDriveId: string | null; iconCx: number; iconCy: number; iconZoom: number; iconAspect: number };

/** DB columns -> picture data for <CroppedImage> (null = use the line icon + colour). Server only (file URLs). */
export function resourceImageOf(r: Row): AvatarData | null {
  if (!r.iconKey && !r.iconDriveId) return null;
  return { url: fileUrl(r.iconKey), driveId: r.iconDriveId, cx: r.iconCx, cy: r.iconCy, zoom: r.iconZoom, aspect: r.iconAspect };
}
