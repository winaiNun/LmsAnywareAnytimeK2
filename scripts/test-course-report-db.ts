/* Needs the local database: npm run test:db (creates rows whose ids start with "zzrep" and removes them). The school report: right counts, schools and centres rolled up, counts only. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { getCourseReport, rollUp, type SchoolRow } from "../src/lib/course/course-report";
import { getTodoCourses, todoBadge } from "../src/lib/course/todo";

const db = new PrismaClient();
const P = "zzrep";

async function cleanup() {
  await db.enrollment.deleteMany({ where: { id: { startsWith: P } } });
  await db.course.deleteMany({ where: { id: { startsWith: P } } });
  await db.school.deleteMany({ where: { id: { startsWith: P } } });
  await db.user.deleteMany({ where: { id: { startsWith: P } } });
}

async function main() {
  // pure roll-up first
  const row = (schoolId: string | null, center: string, district: string, population: number, joined: number, completed: number, late = 0): SchoolRow => ({ schoolId, code: null, name: "x", district, center, population, joined, completed, late });
  const rolled = rollUp([row("1", "ศูนย์ก", "ก", 3, 2, 1), row("2", "ศูนย์ก", "ก", 2, 0, 0), row("3", "ศูนย์ข", "ข", 0, 0, 0), row(null, "", "", 9, 9, 9)], (r) => r.center);
  assert.deepEqual(rolled.map((g) => [g.name, g.population, g.joined, g.completed, g.schools, g.schoolsWithMembers, g.schoolsNotStarted]), [["ศูนย์ก", 5, 2, 1, 2, 2, 1], ["ศูนย์ข", 0, 0, 0, 1, 0, 0]], "members without a school are not in any centre; a school with members but nobody joined counts as not started");
  console.log("ok roll-up");

  await cleanup();
  try {
    const area = await db.learningArea.findFirstOrThrow({ select: { id: true } });
    await db.school.create({ data: { id: `${P}s1`, code: `${P}c1`, name: "ร.ร.หนึ่ง", district: "อ.ก", center: "ศูนย์ก" } });
    await db.school.create({ data: { id: `${P}s2`, code: `${P}c2`, name: "ร.ร.สอง", district: "อ.ก", center: "ศูนย์ก" } });
    await db.school.create({ data: { id: `${P}s3`, code: `${P}c3`, name: "ร.ร.สาม", district: "อ.ข", center: "ศูนย์ข" } });
    const mk = (id: string, memberType: "SCHOOL_ADMIN" | "TEACHER" | "STUDENT" | "DISTRICT_STAFF", schoolId: string | null, active = true) =>
      db.user.create({ data: { id: `${P}${id}`, username: `${P}${id}`, name: id, passwordHash: "x", memberType, schoolId, active } });
    await Promise.all([
      mk("a1", "SCHOOL_ADMIN", `${P}s1`), mk("a2", "SCHOOL_ADMIN", `${P}s1`), mk("b1", "SCHOOL_ADMIN", `${P}s2`),
      mk("t1", "TEACHER", `${P}s1`), mk("stu", "STUDENT", `${P}s1`), mk("off", "SCHOOL_ADMIN", `${P}s2`, false), mk("dist", "DISTRICT_STAFF", null),
    ]);
    await db.user.create({ data: { id: `${P}acct`, username: `${P}acct`, name: "school login", passwordHash: "x", memberType: "SCHOOL_ADMIN" } });
    await db.school.update({ where: { id: `${P}s3` }, data: { accountId: `${P}acct` } }); // a school's own login is not a person
    const due = new Date(Date.now() - 5 * 86400000);
    await db.course.create({ data: { id: `${P}course`, title: "c", areaId: area.id, createdById: `${P}t1`, status: "PUBLISHED", publishedAt: new Date(), audienceTypes: ["SCHOOL_ADMIN"], mandatory: true, dueAt: due } });
    const enr = (id: string, user: string, completedAt: Date | null) => db.enrollment.create({ data: { id: `${P}${id}`, userId: `${P}${user}`, courseId: `${P}course`, completedAt } });
    await Promise.all([
      enr("e1", "a1", new Date(due.getTime() - 86400000)), // on time
      enr("e2", "a2", new Date(due.getTime() + 86400000)), // late
      enr("e3", "t1", new Date()), // a teacher is not in the audience
      enr("e4", "b1", null), // joined, not finished
      enr("e5", "acct", new Date()),
    ]);

    const r = (await getCourseReport(`${P}course`))!;
    const s = (id: string) => r.schools.find((x) => x.schoolId === `${P}${id}`)!;
    assert.deepEqual([s("s1").population, s("s1").joined, s("s1").completed, s("s1").late], [2, 2, 2, 1], "school 1: two administrators, both finished, one late; the teacher and the student are not counted");
    assert.deepEqual([s("s2").population, s("s2").joined, s("s2").completed], [1, 1, 0], "school 2: the disabled one is not counted");
    assert.deepEqual([s("s3").population, s("s3").joined], [0, 0], "a school's own login is not a person");
    assert.equal(r.other, null, "district staff are not in the audience, so nobody is outside a school");
    const c = r.centers.find((g) => g.name.startsWith("ศูนย์ก"))!;
    assert.deepEqual([c.population, c.joined, c.completed, c.schools, c.schoolsWithMembers], [3, 3, 2, 2, 2]);
    assert.deepEqual([r.totals.population, r.totals.joined, r.totals.completed, r.totals.late], [3, 3, 2, 1]);
    assert.equal(JSON.stringify(r).includes(`${P}a1`), false, "no member id in the report");
    console.log("ok report counts");

    // a course with no audience counts every non-student member, and members without a school appear in their own row
    await db.course.update({ where: { id: `${P}course` }, data: { audienceTypes: [] } });
    await db.user.update({ where: { id: `${P}dist` }, data: { active: false } });
    const base = (await getCourseReport(`${P}course`))!; // the database may hold real members without a school: measure my one as a change
    await db.user.update({ where: { id: `${P}dist` }, data: { active: true } });
    const open = (await getCourseReport(`${P}course`))!;
    assert.equal(open.course.defaultAudience, true);
    assert.equal((open.other?.population ?? 0) - (base.other?.population ?? 0), 1, "district staff without a school appear in the 'no school' row");
    assert.equal(open.totals.population - base.totals.population, 1);
    const sp = (id: string) => open.schools.find((x) => x.schoolId === `${P}${id}`)!.population;
    assert.deepEqual([sp("s1"), sp("s2"), sp("s3")], [3, 1, 0], "2 administrators + 1 teacher in school 1 (never the student); school 2 without the disabled user; the school login is not a person");
    console.log("ok default audience");

    // the menu badge and the account box read the same list
    await db.course.update({ where: { id: `${P}course` }, data: { audienceTypes: ["SCHOOL_ADMIN"] } });
    const todoNew = await getTodoCourses(`${P}b1`, "SCHOOL_ADMIN"); // joined, unfinished, past due
    assert.equal(todoNew.some((t) => t.id === `${P}course` && t.state === "overdue" && t.must), true);
    assert.deepEqual(todoBadge(todoNew), { count: todoNew.length, urgent: true });
    assert.equal((await getTodoCourses(`${P}a1`, "SCHOOL_ADMIN")).some((t) => t.id === `${P}course`), false, "finished: gone from the list");
    assert.equal((await getTodoCourses(`${P}t1`, "TEACHER")).some((t) => t.id === `${P}course`), false, "not their audience");
    assert.equal((await getTodoCourses(`${P}stu`, "STUDENT")).some((t) => t.id === `${P}course`), false, "never for students");
    console.log("ok todo list and badge");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
