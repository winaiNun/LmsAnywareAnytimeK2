/**
 * Turns a link someone pasted into "how do we open this": which kind of media it is, the canonical link to
 * keep, a safe embed URL for the in-page viewer (when the site allows framing), and a download link.
 * Pure functions (no imports except the Drive id parser) so every provider can be unit-tested.
 *
 * Safety rules: https only, no credentials in the URL, no IP-address / localhost hosts, and only hosts on
 * the allow-lists below are ever put in an iframe. Anything else becomes a plain LINK that opens in a new tab.
 */
import { parseDriveFileId } from "@/lib/drive";

export type LinkKind = "YOUTUBE" | "DRIVE_FILE" | "GOOGLE_DOC" | "APPS_SCRIPT" | "EMBED" | "LINK";

export type ParsedLink = {
  kind: LinkKind;
  /** canonical link we store */
  url: string;
  /** iframe src, or null when the page must be opened in a new tab */
  embedUrl: string | null;
  /** direct download / export link, when one exists */
  downloadUrl: string | null;
  /** where "open at the source" points */
  openUrl: string;
  provider: string;
};

export type ParseResult = ParsedLink | { error: string };
export const isParsed = (r: ParseResult): r is ParsedLink => !("error" in r);

export const KIND_LABEL: Record<LinkKind | "HTML" | "UPLOAD", string> = {
  YOUTUBE: "วิดีโอ YouTube",
  DRIVE_FILE: "ไฟล์ Google Drive",
  GOOGLE_DOC: "Google Docs/Slides/Sheets/Forms",
  APPS_SCRIPT: "Google Apps Script",
  EMBED: "สื่อฝัง",
  LINK: "ลิงก์ภายนอก",
  HTML: "แอปพลิเคชัน HTML",
  UPLOAD: "ไฟล์อัปโหลด",
};

const MAX_URL = 500;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const hostIs = (host: string, ...names: string[]) => names.some((n) => host === n || host.endsWith(`.${n}`));

function toUrl(raw: string): URL | { error: string } {
  const text = raw.trim();
  if (!text) return { error: "กรุณาวางลิงก์" };
  if (text.length > MAX_URL) return { error: "ลิงก์ยาวเกินไป" };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { error: "ลิงก์ไม่ถูกต้อง" };
  }
  if (u.protocol === "http:") return { error: "ลิงก์ต้องขึ้นต้นด้วย https:// (เว็บที่ไม่ปลอดภัยแสดงในหน้านี้ไม่ได้)" };
  if (u.protocol !== "https:") return { error: "รองรับเฉพาะลิงก์ https://" };
  if (u.username || u.password) return { error: "ลิงก์ห้ามมีชื่อผู้ใช้/รหัสผ่านฝังอยู่" };
  const h = u.hostname;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^[\d.]+$/.test(h) || h.includes(":") || !h.includes(".")) {
    return { error: "ลิงก์ต้องเป็นชื่อเว็บไซต์ที่เปิดได้สาธารณะ" };
  }
  return u;
}

/** For plain "open this website" links (not embeds): same safety rules as media links. Returns the cleaned URL or a Thai error. */
export function safeHttpsUrl(raw: string): { url: string } | { error: string } {
  const u = toUrl(raw);
  return u instanceof URL ? { url: u.toString() } : u;
}

/** "90", "1m30s", "1h2m3s" → seconds */
function seconds(t: string | null): number {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Math.min(Number(t), 86400);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  return m ? Math.min(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0), 86400) : 0;
}

/** The video id of a normalised YouTube link (null for playlists and every other link). */
export const youtubeVideoId = (url: string | null | undefined): string | null => /^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})(?:&|$)/.exec(url ?? "")?.[1] ?? null;
/** Thumbnail of a YouTube video: the 4:3 "hq" picture has black bars that a 16:9 centre crop removes. */
export const youtubeThumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

function youtube(u: URL): ParsedLink | { error: string } | null {
  const h = u.hostname.replace(/^www\./, "");
  if (!hostIs(h, "youtube.com", "youtu.be", "youtube-nocookie.com")) return null;
  let id: string | null = null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (h === "youtu.be") id = parts[0] ?? null;
  else if (u.pathname === "/watch") id = u.searchParams.get("v");
  else if (["shorts", "embed", "live", "v"].includes(parts[0])) id = parts[1] ?? null;
  const list = u.searchParams.get("list");
  const t = seconds(u.searchParams.get("t") ?? u.searchParams.get("start"));
  const watch = (vid: string) => `https://www.youtube.com/watch?v=${vid}`;

  if (id && YT_ID.test(id)) {
    const embed = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${t ? `&start=${t}` : ""}`;
    return { kind: "YOUTUBE", url: `${watch(id)}${t ? `&t=${t}s` : ""}`, embedUrl: embed, downloadUrl: null, openUrl: watch(id), provider: "YouTube" };
  }
  if (list && /^[A-Za-z0-9_-]{10,50}$/.test(list) && (u.pathname === "/playlist" || !id)) {
    return { kind: "YOUTUBE", url: `https://www.youtube.com/playlist?list=${list}`, embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&rel=0`, downloadUrl: null, openUrl: `https://www.youtube.com/playlist?list=${list}`, provider: "YouTube (เพลย์ลิสต์)" };
  }
  return { error: "ลิงก์ YouTube ไม่ถูกต้อง — ใช้ลิงก์วิดีโอ เช่น https://www.youtube.com/watch?v=…" };
}

function drive(u: URL): ParsedLink | { error: string } | null {
  if (u.hostname !== "drive.google.com") return null;
  const id = parseDriveFileId(u.toString());
  if (!id) return { error: "ลิงก์ Google Drive ต้องเป็นลิงก์ไฟล์ (…/file/d/…) ไม่ใช่โฟลเดอร์ — ถ้ามีหลายไฟล์ ให้เพิ่มทีละไฟล์" };
  const view = `https://drive.google.com/file/d/${id}/view`;
  return { kind: "DRIVE_FILE", url: view, embedUrl: `https://drive.google.com/file/d/${id}/preview`, downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`, openUrl: view, provider: "Google Drive" };
}

const DOC_ID = /^[A-Za-z0-9_-]{15,120}$/;

function googleDoc(u: URL): ParsedLink | { error: string } | null {
  if (u.hostname !== "docs.google.com") return null;
  const m = /^\/(document|presentation|spreadsheets|forms)\/(?:u\/\d+\/)?d\/(e\/)?([^/]+)/.exec(u.pathname);
  if (!m || !DOC_ID.test(m[3])) return { error: "ลิงก์ Google Docs/Slides/Sheets/Forms ไม่ถูกต้อง" };
  const [, type, published, id] = m;
  const base = `https://docs.google.com/${type}/d/${published ? "e/" : ""}${id}`;
  const open = `${base}${type === "forms" ? "/viewform" : published ? "/pub" : "/edit"}`;
  const label = { document: "Google Docs", presentation: "Google Slides", spreadsheets: "Google Sheets", forms: "Google Forms" }[type]!;

  if (type === "forms") return { kind: "GOOGLE_DOC", url: open, embedUrl: `${base}/viewform?embedded=true`, downloadUrl: null, openUrl: open, provider: label };
  if (published) return { kind: "GOOGLE_DOC", url: `${base}/pub`, embedUrl: `${base}/pub?embedded=true`, downloadUrl: null, openUrl: `${base}/pub`, provider: label };
  const download = type === "document" ? `${base}/export?format=pdf` : type === "presentation" ? `${base}/export/pdf` : `${base}/export?format=xlsx`;
  return { kind: "GOOGLE_DOC", url: `${base}/edit`, embedUrl: `${base}/preview`, downloadUrl: download, openUrl: `${base}/edit`, provider: label };
}

function appsScript(u: URL): ParsedLink | { error: string } | null {
  if (u.hostname !== "script.google.com") return null;
  const m = /^\/(?:a\/(?:macros\/)?[^/]+\/)?macros\/s\/([A-Za-z0-9_-]{20,200})\/(exec|dev|usercodeapppanel)$/.exec(u.pathname);
  if (!m) return { error: "ลิงก์ Apps Script ต้องเป็นลิงก์ที่ Deploy เป็นเว็บแอป (…/macros/s/…/exec)" };
  if (m[2] === "dev") return { error: "ลิงก์ที่ลงท้าย /dev ใช้ได้เฉพาะเจ้าของสคริปต์ — ให้ Deploy เป็นเว็บแอปแล้วใช้ลิงก์ที่ลงท้าย /exec" };
  return { kind: "APPS_SCRIPT", url: `https://${u.hostname}${u.pathname}`, embedUrl: `https://${u.hostname}${u.pathname}`, downloadUrl: null, openUrl: `https://${u.hostname}${u.pathname}`, provider: "Google Apps Script" };
}

type Provider = { name: string; hosts: string[]; build: (u: URL) => string | null };

/** Sites that are known to allow framing. Add a provider here and it works everywhere (form, viewer, tests). */
export const EMBED_PROVIDERS: Provider[] = [
  {
    name: "Canva",
    hosts: ["canva.com"],
    build: (u) => {
      const m = /^\/design\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/(view|watch)/.exec(u.pathname);
      return m ? `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed` : null;
    },
  },
  {
    name: "Wordwall",
    hosts: ["wordwall.net"],
    build: (u) => (/^\/embed\/[A-Za-z0-9/_-]+$/.test(u.pathname) ? `https://wordwall.net${u.pathname}` : null),
  },
  {
    name: "LearningApps",
    hosts: ["learningapps.org"],
    build: (u) => {
      const id = u.searchParams.get("v") ?? (/^\/(?:view)?(\w+)$/.exec(u.pathname)?.[1] ?? null);
      return id && /^[A-Za-z0-9]{3,20}$/.test(id) ? `https://learningapps.org/watch?v=${id}` : null;
    },
  },
  {
    name: "Genially",
    hosts: ["view.genial.ly", "view.genially.com"],
    build: (u) => (/^\/[A-Za-z0-9]{10,40}(\/[\w-]+)?$/.test(u.pathname) ? `https://${u.hostname}${u.pathname}` : null),
  },
  {
    name: "Padlet",
    hosts: ["padlet.com"],
    build: (u) => (/^\/embed\/[A-Za-z0-9]+$/.test(u.pathname) ? `https://padlet.com${u.pathname}` : null),
  },
  {
    name: "Vimeo",
    hosts: ["vimeo.com", "player.vimeo.com"],
    build: (u) => {
      const m = /^\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{8,12}))?$/.exec(u.pathname);
      return m ? `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}` : null;
    },
  },
  {
    name: "Heyzine",
    hosts: ["heyzine.com"],
    build: (u) => (/^\/flip-book\/[A-Za-z0-9_-]+(\.html)?$/.test(u.pathname) ? `https://heyzine.com${u.pathname}` : null),
  },
  {
    name: "FlipHTML5",
    hosts: ["fliphtml5.com"],
    build: (u) => (/^\/[a-z0-9]+\/[a-z0-9]+\/?$/i.test(u.pathname) ? `https://fliphtml5.com${u.pathname.replace(/\/?$/, "/")}` : null),
  },
  {
    name: "AnyFlip",
    hosts: ["anyflip.com"],
    build: (u) => (/^\/[a-z0-9]+\/[a-z0-9]+\/?$/i.test(u.pathname) ? `https://anyflip.com${u.pathname.replace(/\/?$/, "/")}` : null),
  },
  {
    name: "Spotify",
    hosts: ["open.spotify.com"],
    build: (u) => {
      const m = /^\/(?:intl-[a-z]+\/)?(episode|track|show|playlist|album)\/([A-Za-z0-9]{22})$/.exec(u.pathname);
      return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
    },
  },
  {
    name: "SoundCloud",
    hosts: ["soundcloud.com"],
    build: (u) => {
      const parts = u.pathname.split("/").filter(Boolean);
      return parts.length >= 2 && parts.every((p) => /^[\w.-]+$/.test(p)) ? `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com${u.pathname}`)}` : null;
    },
  },
  {
    name: "Sketchfab",
    hosts: ["sketchfab.com"],
    build: (u) => {
      const id = /^\/(?:3d-models\/[\w-]*?-|models\/)([0-9a-f]{32})(?:\/embed)?$/.exec(u.pathname)?.[1];
      return id ? `https://sketchfab.com/models/${id}/embed` : null;
    },
  },
];

function embedProvider(u: URL): ParsedLink | null {
  for (const p of EMBED_PROVIDERS) {
    if (!hostIs(u.hostname.replace(/^www\./, ""), ...p.hosts)) continue;
    const embed = p.build(u);
    if (!embed) return null; // on the list, but not an embeddable page: treat as a plain link
    const clean = `${u.origin}${u.pathname}${u.search}`;
    return { kind: "EMBED", url: clean, embedUrl: embed, downloadUrl: null, openUrl: clean, provider: p.name };
  }
  return null;
}

/** Entry point for the media form and the server action: never trust the browser's own parsing. */
export function parseMediaLink(raw: string): ParseResult {
  const u = toUrl(raw);
  if ("error" in u) return u;

  for (const f of [youtube, drive, googleDoc, appsScript]) {
    const r = f(u);
    if (r) return r;
  }
  const e = embedProvider(u);
  if (e) return e;

  const clean = `${u.origin}${u.pathname === "/" ? "" : u.pathname}${u.search}`;
  return { kind: "LINK", url: clean, embedUrl: null, downloadUrl: null, openUrl: clean, provider: u.hostname.replace(/^www\./, "") };
}

/** The ONLY hosts a viewer iframe may point at (used again at render time as a second line of defence). */
export function isFrameable(embedUrl: string | null): boolean {
  if (!embedUrl) return false;
  try {
    const u = new URL(embedUrl);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    return (
      hostIs(h, "youtube-nocookie.com") ||
      h === "drive.google.com" ||
      h === "docs.google.com" ||
      h === "script.google.com" ||
      h === "w.soundcloud.com" ||
      h === "player.vimeo.com" ||
      EMBED_PROVIDERS.some((p) => hostIs(h, ...p.hosts))
    );
  } catch {
    return false;
  }
}
