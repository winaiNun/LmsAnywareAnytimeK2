/** Database side of the FAQ chat. Server only. Matching itself lives in match.ts (pure). */
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { MAX_QUERY_LENGTH, normaliseQuestion } from "./match";

export const MAX_UNANSWERED_ROWS = 5000; // a visitor typing endless distinct junk cannot grow the table without bound
export const MAX_FAQ_ITEMS = 300; // matching runs in memory over every active item

/**
 * Counts a question the chat could not answer. One row per distinct (normalised) question, bumped with a single
 * statement so simultaneous visitors never lose a count. Nothing about the visitor is stored. A question the admin
 * had marked ANSWERED reopens when it is asked again (the answer evidently did not match); DISMISSED stays dismissed.
 */
export async function logUnanswered(question: string): Promise<void> {
  const sample = String(question ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
  const norm = normaliseQuestion(sample);
  if (!norm) return;
  // One statement: insert (or bump) the row, but refuse a NEW row once the table is full. Existing rows always bump.
  await db.$executeRaw`
    INSERT INTO "FaqUnanswered" ("id", "norm", "sample", "count", "status", "firstAt", "lastAt")
    SELECT ${randomUUID()}, ${norm}, ${sample}, 1, 'OPEN', now(), now()
    WHERE EXISTS (SELECT 1 FROM "FaqUnanswered" WHERE "norm" = ${norm})
       OR (SELECT count(*) FROM "FaqUnanswered") < ${MAX_UNANSWERED_ROWS}
    ON CONFLICT ("norm") DO UPDATE SET
      "count" = "FaqUnanswered"."count" + 1,
      "lastAt" = now(),
      "status" = CASE WHEN "FaqUnanswered"."status" = 'DISMISSED' THEN 'DISMISSED' ELSE 'OPEN' END`;
}

/** One more visitor got this answer. A single UPDATE; a deleted item is not an error. */
export async function countFaqHit(id: string): Promise<void> {
  await db.faqItem.update({ where: { id }, data: { hitCount: { increment: 1 } } }).catch(() => {});
}
