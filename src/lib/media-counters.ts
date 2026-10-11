/**
 * View / download / like counters. Every change is ONE SQL statement (or one transaction), so two people acting at
 * the same moment can not lose an update, and a counter can never drift away from the rows it counts.
 * Only PUBLISHED media is counted: previews by reviewers and drafts never move a number.
 */
import { db } from "@/lib/db";
import { bangkokParts } from "@/lib/thai-date";

/** The calendar day in Bangkok, as the DATE we store (midnight UTC of that date). */
export function bangkokDay(now: Date = new Date()): Date {
  const p = bangkokParts(now);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

/** +1 view (total and today's bucket). Returns false when the item is not published (nothing is written). */
export async function recordView(mediaId: string, now: Date = new Date()): Promise<boolean> {
  const n = await db.$executeRaw`
    WITH m AS (
      UPDATE "Media" SET "viewCount" = "viewCount" + 1 WHERE "id" = ${mediaId} AND "status" = 'PUBLISHED' RETURNING "id"
    )
    INSERT INTO "MediaViewDaily" ("mediaId", "day", "views") SELECT "id", ${bangkokDay(now)}::date, 1 FROM m
    ON CONFLICT ("mediaId", "day") DO UPDATE SET "views" = "MediaViewDaily"."views" + 1`;
  return n > 0;
}

/** +1 download / "open the original" click. */
export async function recordOpen(mediaId: string): Promise<boolean> {
  const n = await db.$executeRaw`UPDATE "Media" SET "downloadCount" = "downloadCount" + 1 WHERE "id" = ${mediaId} AND "status" = 'PUBLISHED'`;
  return n > 0;
}

/**
 * Set (not toggle) a member's like. Idempotent: asking for the state they already have changes nothing, so a double
 * click or a retry can never count twice. `likeCount` moves only when a row really was added / removed.
 */
export async function setLike(userId: string, mediaId: string, liked: boolean): Promise<{ liked: boolean; likeCount: number } | null> {
  return db.$transaction(async (tx) => {
    const media = await tx.media.findFirst({ where: { id: mediaId, status: "PUBLISHED" }, select: { id: true } });
    if (!media) return null;
    if (liked) {
      const added = await tx.$executeRaw`INSERT INTO "MediaLike" ("userId", "mediaId") VALUES (${userId}, ${mediaId}) ON CONFLICT DO NOTHING`;
      if (added > 0) await tx.$executeRaw`UPDATE "Media" SET "likeCount" = "likeCount" + 1 WHERE "id" = ${mediaId}`;
    } else {
      const removed = await tx.$executeRaw`DELETE FROM "MediaLike" WHERE "userId" = ${userId} AND "mediaId" = ${mediaId}`;
      if (removed > 0) await tx.$executeRaw`UPDATE "Media" SET "likeCount" = GREATEST("likeCount" - 1, 0) WHERE "id" = ${mediaId}`;
    }
    const m = await tx.media.findUniqueOrThrow({ where: { id: mediaId }, select: { likeCount: true } });
    return { liked, likeCount: m.likeCount };
  });
}

/** Ids of the most viewed media over the last `days` Bangkok days (sum of the daily buckets). */
export async function topViewedIds(limit: number, days = 30, now: Date = new Date()): Promise<string[]> {
  const since = bangkokDay(new Date(now.getTime() - (days - 1) * 86400000));
  const rows = await db.$queryRaw<{ mediaId: string }[]>`
    SELECT d."mediaId" FROM "MediaViewDaily" d JOIN "Media" m ON m."id" = d."mediaId"
    WHERE d."day" >= ${since}::date AND m."status" = 'PUBLISHED'
    GROUP BY d."mediaId" ORDER BY SUM(d."views") DESC, MAX(m."viewCount") DESC LIMIT ${limit}`;
  return rows.map((r) => r.mediaId);
}
