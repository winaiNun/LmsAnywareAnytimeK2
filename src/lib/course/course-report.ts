/**
 * School-by-school report of one course (server only): for the people the course is meant for, how many exist, joined and finished,
 * per school, network centre and district. COUNTS ONLY: no names, e-mails or individual results (the learners tab has the
 * individual list for the course owner and admins). School logins are not people and are left out.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ReportCounts = { population: number; joined: number; completed: number; late: number };
export type SchoolRow = ReportCounts & { schoolId: string | null; code: string | null; name: string; district: string; center: string };
export type GroupRow = ReportCounts & { name: string; schools: number; schoolsWithMembers: number; schoolsNotStarted: number };

/** When the course names no audience, the report covers every member who is not a student. */
export const DEFAULT_REPORT_TYPES = ["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR", "DISTRICT_STAFF", "GENERAL"];

const zero = (): ReportCounts => ({ population: 0, joined: 0, completed: 0, late: 0 });
const add = (a: ReportCounts, b: ReportCounts) => ({ population: a.population + b.population, joined: a.joined + b.joined, completed: a.completed + b.completed, late: a.late + b.late });

/** Roll school rows up by a key (district or centre). Pure, so the arithmetic can be tested. */
export function rollUp(rows: SchoolRow[], key: (r: SchoolRow) => string): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const r of rows) {
    if (r.schoolId === null) continue; // members without a school belong to no district/centre
    const k = key(r);
    const g = map.get(k) ?? { name: k, ...zero(), schools: 0, schoolsWithMembers: 0, schoolsNotStarted: 0 };
    Object.assign(g, add(g, r));
    g.schools++;
    if (r.population > 0) g.schoolsWithMembers++;
    if (r.population > 0 && r.joined === 0) g.schoolsNotStarted++;
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
}

export async function getCourseReport(courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, status: true, audienceTypes: true, mandatory: true, dueAt: true, createdById: true } });
  if (!course) return null;
  const types: string[] = course.audienceTypes.length > 0 ? course.audienceTypes : DEFAULT_REPORT_TYPES;
  const [counts, schools] = await Promise.all([
    db.$queryRaw<{ schoolId: string | null; population: number; joined: number; completed: number; late: number }[]>(Prisma.sql`
      SELECT u."schoolId" AS "schoolId",
             count(*)::int AS population,
             count(e."id")::int AS joined,
             count(e."completedAt")::int AS completed,
             count(*) FILTER (WHERE e."completedAt" IS NOT NULL AND ${course.dueAt}::timestamp IS NOT NULL AND e."completedAt" > ${course.dueAt}::timestamp)::int AS late
      FROM "User" u
      LEFT JOIN "Enrollment" e ON e."userId" = u."id" AND e."courseId" = ${courseId}
      WHERE u."active" AND u."memberType" = ANY(${types}::text[]::"MemberType"[])
        AND NOT EXISTS (SELECT 1 FROM "School" s WHERE s."accountId" = u."id")
      GROUP BY u."schoolId"`),
    db.school.findMany({ where: { active: true }, select: { id: true, code: true, name: true, district: true, center: true }, orderBy: [{ district: "asc" }, { center: "asc" }, { name: "asc" }] }),
  ]);
  const by = new Map(counts.map((c) => [c.schoolId, c]));
  const rows: SchoolRow[] = schools.map((s) => {
    const c = by.get(s.id);
    return { schoolId: s.id, code: s.code, name: s.name, district: s.district, center: s.center, population: c?.population ?? 0, joined: c?.joined ?? 0, completed: c?.completed ?? 0, late: c?.late ?? 0 };
  });
  const noSchool = by.get(null);
  const other: SchoolRow | null = noSchool ? { schoolId: null, code: null, name: "ไม่ระบุโรงเรียน (สังกัดหน่วยงานอื่น)", district: "", center: "", population: noSchool.population, joined: noSchool.joined, completed: noSchool.completed, late: noSchool.late } : null;
  const all = other ? [...rows, other] : rows;
  const totals = all.reduce<ReportCounts>((t, r) => add(t, r), zero());
  return {
    course: { id: course.id, title: course.title, status: course.status, audience: course.audienceTypes as string[], defaultAudience: course.audienceTypes.length === 0, mandatory: course.mandatory, dueAt: course.dueAt, createdById: course.createdById },
    totals,
    schools: rows,
    other,
    centers: rollUp(rows, (r) => `${r.center} (อ.${r.district})`),
    districts: rollUp(rows, (r) => `อ.${r.district}`),
  };
}

export type CourseReport = NonNullable<Awaited<ReturnType<typeof getCourseReport>>>;
