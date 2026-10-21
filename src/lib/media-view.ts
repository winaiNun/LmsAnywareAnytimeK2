import { isFrameable, parseMediaLink, isParsed, KIND_LABEL } from "@/lib/embed";
import { fileUrl } from "@/lib/site";

export type RawItem = { id: string; kind: string; label: string; url: string | null; storageKey: string | null; mimeType: string | null; sizeBytes: number | null; html: string | null };

/** Everything a viewer needs to open one item (built on the server from the stored row). */
export type ViewItem = {
  id: string;
  kind: string;
  kindLabel: string;
  label: string;
  provider: string;
  /** iframe src, or null when the item has to be opened in a new tab */
  frameSrc: string | null;
  /** how tall the frame should be */
  shape: "video" | "tall" | "audio";
  openUrl: string | null;
  downloadUrl: string | null;
  isHtml: boolean;
  sizeBytes: number | null;
  /** a picture we store: shown as an image instead of a frame */
  imageSrc?: string | null;
};

const AUDIO = new Set(["Spotify", "SoundCloud"]);

export function toViewItem(it: RawItem): ViewItem {
  const base = { id: it.id, kind: it.kind, kindLabel: KIND_LABEL[it.kind as keyof typeof KIND_LABEL] ?? it.kind, label: it.label, sizeBytes: it.sizeBytes, isHtml: it.kind === "HTML", imageSrc: null as string | null };

  if (it.kind === "HTML") {
    // served by our own sandboxed route (see src/app/library/html/[itemId]/route.ts)
    return { ...base, provider: "HTML", frameSrc: `/library/html/${it.id}`, shape: "video", openUrl: `/library/html/${it.id}`, downloadUrl: null };
  }
  if (it.kind === "UPLOAD") {
    const url = fileUrl(it.storageKey);
    const pdf = it.mimeType === "application/pdf";
    if (it.mimeType?.startsWith("image/")) return { ...base, provider: "รูปภาพ", frameSrc: null, shape: "tall", openUrl: url, downloadUrl: null, imageSrc: url };
    return { ...base, provider: "ไฟล์", frameSrc: pdf ? url : null, shape: "tall", openUrl: url, downloadUrl: url };
  }
  const r = it.url ? parseMediaLink(it.url) : null;
  if (!r || !isParsed(r)) return { ...base, provider: "ลิงก์", frameSrc: null, shape: "video", openUrl: it.url, downloadUrl: null };
  const frameSrc = isFrameable(r.embedUrl) ? r.embedUrl : null; // checked again here, not only when the link was saved
  const tall = it.kind === "DRIVE_FILE" || it.kind === "GOOGLE_DOC";
  return { ...base, provider: r.provider, frameSrc, shape: AUDIO.has(r.provider) ? "audio" : tall ? "tall" : "video", openUrl: r.openUrl, downloadUrl: r.downloadUrl };
}

