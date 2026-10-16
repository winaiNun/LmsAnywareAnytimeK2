/** Downloads and reads one outside feed. Server only. See host-guard.ts for why every hop is checked. */
import { allowPrivateForTests, assertPublicHost, checkFeedUrl } from "./host-guard";
import { parseFeed, type ParsedFeed } from "./parse";

export const FEED_TIMEOUT_MS = 6000;
export const FEED_MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TYPE_OK = /xml|rss|atom|text\/plain|octet-stream|rdf/i;

export type FeedResult = { ok: true; feed: ParsedFeed } | { ok: false; error: string };

async function readCapped(res: Response, signal: AbortSignal): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > FEED_MAX_BYTES) throw new Error("ฟีดนี้ใหญ่เกินไป (เกิน 2 MB)");
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    if (signal.aborted) throw new Error("เว็บต้นทางตอบช้าเกินไป");
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > FEED_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error("ฟีดนี้ใหญ่เกินไป (เกิน 2 MB)");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** The text of the document, decoded with the charset the server or the XML header names (Thai sites still use windows-874). */
function decode(bytes: Uint8Array, contentType: string): string {
  const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 300));
  const label = (/charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1] ?? /<\?xml[^>]*encoding\s*=\s*["']([\w-]+)["']/i.exec(head)?.[1] ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Fetch + parse. Never throws: a problem comes back as a Thai message the admin (and the page) can show. */
export async function fetchFeed(rawUrl: string): Promise<FeedResult> {
  const allowPrivate = allowPrivateForTests();
  const first = checkFeedUrl(rawUrl, { allowPrivate });
  if (!first.ok) return first;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FEED_TIMEOUT_MS);
  try {
    let url = first.url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHost(new URL(url).hostname, { allowPrivate });
      const res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5", "User-Agent": "AnywhereAnytimeNewsReader/1.0" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || hop === MAX_REDIRECTS) return { ok: false, error: "เว็บต้นทางส่งต่อลิงก์หลายครั้งเกินไป" };
        const next = checkFeedUrl(new URL(loc, url).toString(), { allowPrivate }); // a redirect may not lead somewhere we would refuse to start with
        if (!next.ok) return { ok: false, error: next.error };
        url = next.url;
        continue;
      }
      if (!res.ok) return { ok: false, error: `เว็บต้นทางตอบกลับ ${res.status}` };
      const type = res.headers.get("content-type") ?? "";
      if (type && !TYPE_OK.test(type)) return { ok: false, error: "ลิงก์นี้ไม่ใช่ฟีด (เป็นหน้าเว็บทั่วไป) — ใช้ลิงก์ RSS/Atom ของเว็บนั้น" };
      const bytes = await readCapped(res, ctrl.signal);
      return { ok: true, feed: parseFeed(decode(bytes, type), url) };
    }
    return { ok: false, error: "เว็บต้นทางส่งต่อลิงก์หลายครั้งเกินไป" };
  } catch (e) {
    if (ctrl.signal.aborted) return { ok: false, error: "เว็บต้นทางตอบช้าเกินไป" };
    return { ok: false, error: e instanceof Error && /[฀-๿]/.test(e.message) ? e.message : "ดึงฟีดไม่สำเร็จ (เชื่อมต่อเว็บต้นทางไม่ได้)" };
  } finally {
    clearTimeout(timer);
  }
}
