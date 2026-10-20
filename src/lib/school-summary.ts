/**
 * What a school may see about its own people (server only). Counts only: no names, e-mail or progress of any individual,
 * and a student is never listed - the school sees how many of its students joined, nothing more. "People" are the members who
 * chose this school when they signed up (User.schoolId).
 */
import { db } from "@/lib/db";
import { MEMBER_TYPES, type MemberTypeKey } from "@/lib/members";

export type SchoolSummary = {
  members: { type: MemberTypeKey; count: number }[];
  adults: number;
  students: number;
  mediaPublished: number;
  coursesPublished: number;
  studentLearners: number; // students who joined at least one course (a count)
  certificates: number;
  courses: { id: string; title: string; audience: string[]; enrolled: number; completed: number }[];
};

export async function getSchoolSummary(schoolId: string): Promise<SchoolSummary> {
  const people = { schoolId, active: true };
  const adults = { ...people, memberType: { not: "STUDENT" as const } };
  const [byType, mediaPublished, coursesPublished, studentLearners, certificates, enrolled, completed] = await Promise.all([
    db.user.groupBy({ by: ["memberType"], where: people, _count: { _all: true } }),
    db.media.count({ where: { status: "PUBLISHED", createdBy: adults } }),
    db.course.count({ where: { status: "PUBLISHED", createdBy: adults } }),
    db.user.count({ where: { ...people, memberType: "STUDENT", enrollments: { some: { course: { status: "PUBLISHED" } } } } }),
    db.certificate.count({ where: { status: "ISSUED", user: adults } }),
    db.enrollment.groupBy({ by: ["courseId"], where: { user: adults, course: { status: "PUBLISHED" } }, _count: { _all: true } }),
    db.enrollment.groupBy({ by: ["courseId"], where: { user: adults, completedAt: { not: null }, course: { status: "PUBLISHED" } }, _count: { _all: true } }),
  ]);
  const members = MEMBER_TYPES.map((type) => ({ type, count: byType.find((r) => r.memberType === type)?._count._all ?? 0 })).filter((m) => m.count > 0);
  const courseRows = enrolled.length
    ? await db.course.findMany({ where: { id: { in: enrolled.map((e) => e.courseId) } }, select: { id: true, title: true, audienceTypes: true } })
    : [];
  const done = new Map(completed.map((r) => [r.courseId, r._count._all]));
  const courses = enrolled
    .map((e) => {
      const c = courseRows.find((x) => x.id === e.courseId);
      return c ? { id: c.id, title: c.title, audience: c.audienceTypes as string[], enrolled: e._count._all, completed: done.get(c.id) ?? 0 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.enrolled - a.enrolled || a.title.localeCompare(b.title, "th"))
    .slice(0, 20);
  const studentCount = members.find((m) => m.type === "STUDENT")?.count ?? 0;
  return { members, adults: members.reduce((n, m) => n + (m.type === "STUDENT" ? 0 : m.count), 0), students: studentCount, mediaPublished, coursesPublished, studentLearners, certificates, courses };
}
