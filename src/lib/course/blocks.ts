/**
 * Pure checks for the content blocks of a lesson (VIDEO / LINK / MEDIA / TEXT / QUIZ): what each kind needs, and how
 * a YouTube link becomes the video id the tracked player uses. Shared by the server (save) and the editor (preview).
 */
import { isParsed, parseMediaLink } from "@/lib/embed";
import type { BlockKind } from "./rules";

export const BLOCK_KINDS: BlockKind[] = ["VIDEO", "LINK", "MEDIA", "TEXT", "QUIZ"];
export const BLOCK_LABEL: Record<BlockKind, string> = {
  VIDEO: "วิดีโอ YouTube (นับการดู)",
  LINK: "ลิงก์สื่อ (Drive, Docs, Apps Script, Canva ฯลฯ)",
  MEDIA: "สื่อจากคลังสื่อ",
  TEXT: "ข้อความอธิบาย",
  QUIZ: "แบบทดสอบ / แบบฝึกหัด",
};
export const MAX_TEXT = 20000;

export type BlockInput = {
  kind: BlockKind;
  label?: string;
  url?: string | null;
  mediaId?: string | null;
  text?: string | null;
  quizId?: string | null;
  required?: boolean;
  minPercent?: number | null;
};

export type CleanBlock = {
  kind: BlockKind;
  label: string;
  url: string | null;
  mediaId: string | null;
  text: string | null;
  quizId: string | null;
  required: boolean;
  minPercent: number | null;
};

/** The 11-character id of a single YouTube video (null for playlists and anything else). */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$|^youtu\.be$/.test(u.hostname)) return null;
    const id = u.hostname === "youtu.be" ? u.pathname.split("/")[1] : u.searchParams.get("v");
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Start time (seconds) a YouTube link asks for, "&t=90s" style (0 when none). */
export function youtubeStart(url: string | null | undefined): number {
  if (!url) return 0;
  try {
    const t = new URL(url).searchParams.get("t");
    const n = t ? parseInt(t, 10) : 0;
    return Number.isFinite(n) && n > 0 ? Math.min(n, 86400) : 0;
  } catch {
    return 0;
  }
}

export function parseVideoLink(raw: string): { ok: true; url: string; videoId: string } | { ok: false; error: string } {
  const r = parseMediaLink(raw);
  if (!isParsed(r)) return { ok: false, error: r.error };
  const id = r.kind === "YOUTUBE" ? youtubeVideoId(r.url) : null;
  if (!id) return { ok: false, error: "ใช้ลิงก์วิดีโอ YouTube เดี่ยว (ไม่ใช่เพลย์ลิสต์) เช่น https://www.youtube.com/watch?v=… — ลิงก์อื่นให้ใช้ชนิด “ลิงก์สื่อ”" };
  return { ok: true, url: r.url, videoId: id };
}

/** Check one block as typed in the editor and return the clean row to store. Does not look at the database. */
export function cleanBlock(input: BlockInput): { ok: true; block: CleanBlock } | { ok: false; error: string } {
  const base = { label: (input.label ?? "").trim().slice(0, 80), url: null as string | null, mediaId: null as string | null, text: null as string | null, quizId: null as string | null, required: !!input.required, minPercent: null as number | null };
  switch (input.kind) {
    case "VIDEO": {
      const v = parseVideoLink(input.url ?? "");
      if (!v.ok) return v;
      const min = input.minPercent ?? null;
      if (min !== null && (!Number.isInteger(min) || min < 10 || min > 100)) return { ok: false, error: "เปอร์เซ็นต์ที่ต้องดูต้องอยู่ระหว่าง 10–100" };
      return { ok: true, block: { ...base, kind: "VIDEO", url: v.url, minPercent: min } };
    }
    case "LINK": {
      const r = parseMediaLink(input.url ?? "");
      if (!isParsed(r)) return { ok: false, error: r.error };
      return { ok: true, block: { ...base, kind: "LINK", url: r.url } };
    }
    case "MEDIA": {
      if (!input.mediaId) return { ok: false, error: "กรุณาเลือกสื่อจากคลังสื่อ" };
      return { ok: true, block: { ...base, kind: "MEDIA", mediaId: input.mediaId } };
    }
    case "TEXT": {
      const text = (input.text ?? "").trim();
      if (!text) return { ok: false, error: "กรุณาพิมพ์ข้อความ" };
      if (text.length > MAX_TEXT) return { ok: false, error: `ข้อความยาวเกิน ${MAX_TEXT.toLocaleString("th-TH")} ตัวอักษร` };
      return { ok: true, block: { ...base, kind: "TEXT", text } };
    }
    case "QUIZ": {
      if (!input.quizId) return { ok: false, error: "กรุณาเลือกแบบทดสอบ" };
      return { ok: true, block: { ...base, kind: "QUIZ", quizId: input.quizId } };
    }
    default:
      return { ok: false, error: "ชนิดเนื้อหาไม่ถูกต้อง" };
  }
}
