/**
 * Rate limiter that keeps its counts in the database, so the limit holds across serverless instances
 * (the in-memory one in rate-limit.ts only sees one instance). Server only.
 */
import { db } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

const since = (windowMs: number) => new Date(Date.now() - windowMs);

/** Counts this attempt and tells whether the key went over `max` inside the window. */
export async function rateLimitedDb(key: string, max: number, windowMs: number): Promise<boolean> {
  await db.rateLimitHit.create({ data: { key } });
  const n = await db.rateLimitHit.count({ where: { key, createdAt: { gte: since(windowMs) } } });
  if (Math.random() < 0.02) await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - DAY) } } }).catch(() => {});
  return n > max;
}

/** Has the key already used up `max` attempts in the window? (does not count anything) */
export async function limitReached(key: string, max: number, windowMs: number): Promise<boolean> {
  return (await db.rateLimitHit.count({ where: { key, createdAt: { gte: since(windowMs) } } })) >= max;
}

/** Counts one attempt (e.g. a failed sign-in). */
export async function recordHit(key: string): Promise<void> {
  await db.rateLimitHit.create({ data: { key } });
}

/** Forgets the attempts of a key (e.g. after a successful sign-in). */
export async function clearHits(key: string): Promise<void> {
  await db.rateLimitHit.deleteMany({ where: { key } });
}
