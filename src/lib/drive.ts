/**
 * Google Drive public-link helpers (no imports: usable on server and client).
 *
 * We never hot-link Drive on the public site. An author pastes a "anyone with the link" URL, the server
 * downloads Drive's own preview thumbnail ONCE (sharp then crops/shrinks it like any upload), and the
 * result is kept as a small WebP in our storage. Works for images and for PDFs (first page).
 */

// Drive file ids are url-safe base64-ish, typically 25-60 chars.
const ID = /^[A-Za-z0-9_-]{15,120}$/;

/**
 * Pull the file id out of a Drive link. Accepts only drive.google.com file links:
 *   /file/d/<id>/view|preview|edit   /open?id=<id>   /uc?id=<id>&export=...   /thumbnail?id=<id>
 * Folder links, other hosts and look-alike domains return null.
 */
export function parseDriveFileId(link: string | null | undefined): string | null {
  if (!link) return null;
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com") return null;

  const path = /^\/file\/(?:u\/\d+\/)?d\/([^/]+)/.exec(url.pathname);
  const id = path ? path[1] : url.searchParams.get("id");
  if (!id || !ID.test(id)) return null;
  if (/^\/drive\/(?:u\/\d+\/)?folders\//.test(url.pathname) || url.pathname.startsWith("/folders/")) return null;
  return id;
}

/** Drive's own thumbnail endpoint: a small picture of the file (first page for a PDF). `width` in px. */
export const driveThumbnailUrl = (id: string, width = 1800) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`;

/** The canonical link we keep in the database. */
export const driveViewUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;
