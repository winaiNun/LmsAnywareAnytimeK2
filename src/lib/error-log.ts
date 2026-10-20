/**
 * Error log (server only). A problem is stored once and counted, so a page that breaks for 500 people is one row with count 500,
 * not 500 rows. Nothing personal is kept: no IP address, no browser string, e-mail addresses and long digit runs are masked
 * out of messages, and the person is an id only. The same text is what an admin reads in /admin/errors.
 */
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export const MAX_MESSAGE = 300;
export const MAX_STACK = 1500;
export const MAX_ROWS = 500;

/** Mask what must not be stored: e-mail addresses, long numbers (ID cards, phones), tokens in URLs. */
export function scrub(text: string, max: number): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\d{9,}/g, "[number]")
    .replace(/(token|key|secret|password|code)=([^\s&"']+)/gi, "$1=[x]")
    .slice(0, max);
}

/** The page without query string / fragment, bounded. Never keeps what might hold a token. */
export function cleanPath(raw: string): string {
  const p = String(raw ?? "").split(/[?#]/)[0] || "/";
  return (p.startsWith("/") ? p : `/${p}`).slice(0, 200);
}

/** Same problem -> same fingerprint. A server digest is the best key (it is what the host's own logs show); otherwise message + page. */
export function fingerprintOf(e: { digest?: string | null; message: string; path: string; source: string }): string {
  if (e.digest) return `d:${e.digest.slice(0, 40)}`;
  const firstLine = e.message.split("\n")[0].replace(/\d+/g, "N"); // "item 17 not found" and "item 18 not found" are one problem
  return `h:${createHash("sha1").update(`${e.source}|${firstLine}|${e.path}`).digest("hex").slice(0, 20)}`;
}

export type ErrorReport = { source: "client" | "server" | "boundary"; message: string; stack?: string | null; path: string; digest?: string | null; userId?: string | null };

/** Store or count one problem. Never throws: reporting an error must not cause another. */
export async function logError(r: ErrorReport): Promise<void> {
  try {
    const message = scrub(r.message || "(no message)", MAX_MESSAGE);
    const path = cleanPath(r.path);
    const fingerprint = fingerprintOf({ digest: r.digest, message, path, source: r.source });
    const stack = r.stack ? scrub(r.stack, MAX_STACK) : null;
    await db.errorLog.upsert({
      where: { fingerprint },
      create: { fingerprint, source: r.source, message, stack, path, userId: r.userId ?? null },
      // a problem that comes back after being marked fixed is open again
      update: { count: { increment: 1 }, lastAt: new Date(), resolvedAt: null, userId: r.userId ?? undefined },
    });
    if (Math.random() < 0.02) await sweep(); // keep the table small without a scheduled job
  } catch (e) {
    console.error("error log failed", e);
  }
}

/** Keep at most MAX_ROWS problems: drop the oldest fixed ones first, then the oldest untouched ones. */
export async function sweep(): Promise<void> {
  const total = await db.errorLog.count();
  if (total <= MAX_ROWS) return;
  const old = await db.errorLog.findMany({ orderBy: [{ resolvedAt: { sort: "desc", nulls: "last" } }, { lastAt: "asc" }], take: total - MAX_ROWS, select: { id: true } });
  await db.errorLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}

/** Unfixed problems seen in the last 24 hours (dashboard alert and menu badge). */
export const recentOpenErrors = (now = new Date()) => db.errorLog.count({ where: { resolvedAt: null, lastAt: { gte: new Date(now.getTime() - 86400000) } } });
