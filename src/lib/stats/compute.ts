/**
 * Counts for the home-page stat cards. Server only. Each number is one light query; the page never calls this directly
 * (data.ts caches the result for ten minutes). "Creator" = the owner of published media / a published course, never a student
 * account (students stay anonymous on the public pages) and never a disabled account.
 */
import { db } from "@/lib/db";
import type { StatMetric } from "./metrics";

const n = (rows: { n: bigint | number }[]): number => Math.max(0, Number(rows[0]?.n ?? 0));

const COUNTERS: Record<StatMetric, () => Promise<number>> = {
  media: () => db.media.count({ where: { status: "PUBLISHED" } }),
  courses: () => db.course.count({ where: { status: "PUBLISHED" } }),
  creators: async () =>
    n(await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "User" u
      WHERE u."active" AND u."memberType" <> 'STUDENT'
        AND (EXISTS (SELECT 1 FROM "Media" m WHERE m."createdById" = u."id" AND m."status" = 'PUBLISHED')
          OR EXISTS (SELECT 1 FROM "Course" c WHERE c."createdById" = u."id" AND c."status" = 'PUBLISHED'))`),
  mediaCreators: async () =>
    n(await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "User" u
      WHERE u."active" AND u."memberType" <> 'STUDENT'
        AND EXISTS (SELECT 1 FROM "Media" m WHERE m."createdById" = u."id" AND m."status" = 'PUBLISHED')`),
  instructors: async () =>
    n(await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM "User" u
      WHERE u."active" AND u."memberType" <> 'STUDENT'
        AND EXISTS (SELECT 1 FROM "Course" c WHERE c."createdById" = u."id" AND c."status" = 'PUBLISHED')`),
  students: () => db.user.count({ where: { memberType: "STUDENT", active: true } }),
  members: () => db.user.count({ where: { active: true } }),
  learners: async () =>
    n(await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(DISTINCT e."userId") AS n FROM "Enrollment" e
      JOIN "Course" c ON c."id" = e."courseId" AND c."status" = 'PUBLISHED'
      JOIN "User" u ON u."id" = e."userId" AND u."active"`),
  enrollments: () => db.enrollment.count({ where: { course: { status: "PUBLISHED" } } }),
  certificates: () => db.certificate.count({ where: { status: "ISSUED" } }),
  schools: () => db.school.count({ where: { active: true } }),
};

/** The numbers of the asked-for metrics (each counted once, all in parallel). A metric that fails to count shows 0 rather than breaking the page. */
export async function computeStats(metrics: StatMetric[]): Promise<Record<string, number>> {
  const keys = Array.from(new Set(metrics));
  const values = await Promise.all(keys.map((k) => COUNTERS[k]().catch(() => 0)));
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}
