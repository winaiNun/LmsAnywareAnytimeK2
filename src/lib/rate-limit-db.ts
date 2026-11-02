/**
 * Rate limiter that keeps its counts in the database, so the limit holds across serverless instances
 * (the in-memory one in rate-limit.ts only sees one instance). Server only.
 */
import { db } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Sign-in / sign-up limits. A whole school or training room often shares ONE public IP, so the per-IP limits are
 * high and count only WRONG tries (a correct code or password never uses up the room's allowance); the tight limit
 * is per account. An admin can clear every counter at once (unlockSignIns) during a training session.
 */
export const LIMITS = {
  window: 15 * 60 * 1000,
  loginFailsPerAccount: 8,
  loginFailsPerIp: 100,
  codeFailsPerIp: 30,
  signupsPerIp: 100,
};
/** Key prefixes of the sign-in / sign-up counters (see unlockSignIns). */
const SIGN_IN_KEYS = ["login-id:", "login-ip:", "code:", "register:"];

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

/** Admin "unlock": forgets every sign-in / sign-up counter (wrong passwords, wrong codes, sign-ups per IP). */
export async function unlockSignIns(): Promise<number> {
  const r = await db.rateLimitHit.deleteMany({ where: { OR: SIGN_IN_KEYS.map((p) => ({ key: { startsWith: p } })) } });
  return r.count;
}

/** How many sign-in / sign-up counters are at their limit right now (shown next to the unlock button). */
export async function lockedSignIns(): Promise<number> {
  const since15 = since(LIMITS.window);
  const rows = await db.rateLimitHit.groupBy({ by: ["key"], where: { createdAt: { gte: since15 }, OR: SIGN_IN_KEYS.map((p) => ({ key: { startsWith: p } })) }, _count: { _all: true } });
  const max = (key: string) =>
    key.startsWith("login-id:") ? LIMITS.loginFailsPerAccount : key.startsWith("login-ip:") ? LIMITS.loginFailsPerIp : key.startsWith("code:") ? LIMITS.codeFailsPerIp : LIMITS.signupsPerIp;
  return rows.filter((r) => r._count._all >= max(r.key)).length;
}
