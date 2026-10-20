/* Needs the local database: npm run test:db (creates rows whose ids start with "zzsch" and removes them). The school's summary is counts only and never leaks students; a school's own login can not enrol. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { enrollAs } from "../src/lib/course/course-review";
import { getSchoolSummary } from "../src/lib/school-summary";

const db = new PrismaClient();
const P = "zzsch";

async function cleanup() {
  await db.enrollment.deleteMany({ where: { id: { startsWith: P } } });
  await db.media.deleteMany({ where: { id: { startsWith: P } } });
  await db.course.deleteMany({ where: { id: { startsWith: P } } });
  await db.school.deleteMany({ where: { id: { startsWith: P } } });
  await db.user.deleteMany({ where: { id: { startsWith: P } } });
}

async function main() {
  await cleanup();
  try {
    const area = await db.learningArea.findFirstOrThrow({ select: { id: true } });
    const mk = (id: string, memberType: "TEACHER" | "SCHOOL_ADMIN" | "STUDENT" | "GENERAL", schoolId: string | null, active = true) =>
      db.user.create({ data: { id: `${P}${id}`, username: `${P}${id}`, name: id, passwordHash: "x", memberType, schoolId, active } });
    await db.user.create({ data: { id: `${P}acct`, username: `${P}acct`, name: "school", passwordHash: "x", memberType: "GENERAL" } });
    await db.school.create({ data: { id: `${P}a`, code: `${P}code1`, name: "ร.ร.ก", district: "ก", center: "ก", accountId: `${P}acct` } });
    await db.school.create({ data: { id: `${P}b`, code: `${P}code2`, name: "ร.ร.ข", district: "ก", center: "ก" } });
    await Promise.all([
      mk("t1", "TEACHER", `${P}a`), mk("t2", "TEACHER", `${P}a`), mk("p1", "SCHOOL_ADMIN", `${P}a`), mk("s1", "STUDENT", `${P}a`), mk("s2", "STUDENT", `${P}a`),
      mk("off", "TEACHER", `${P}a`, false), mk("other", "TEACHER", `${P}b`),
    ]);
    const course = (id: string, status: "PUBLISHED" | "DRAFT", by: string) => db.course.create({ data: { id: `${P}${id}`, title: id, areaId: area.id, createdById: `${P}${by}`, status, publishedAt: status === "PUBLISHED" ? new Date() : null, audienceTypes: id === "c1" ? ["SCHOOL_ADMIN"] : [] } });
    await course("c1", "PUBLISHED", "t1");
    await course("c2", "PUBLISHED", "other");
    await course("c3", "DRAFT", "t1");
    await db.media.create({ data: { id: `${P}m1`, title: "m", areaId: area.id, createdById: `${P}t1`, status: "PUBLISHED", publishedAt: new Date() } });
    await db.media.create({ data: { id: `${P}m2`, title: "m", areaId: area.id, createdById: `${P}t1`, status: "DRAFT" } });
    await db.media.create({ data: { id: `${P}m3`, title: "m", areaId: area.id, createdById: `${P}s1`, status: "PUBLISHED", publishedAt: new Date() } }); // a student's media is not counted as the school's adults' work
    const enr = (id: string, user: string, courseId: string, done: boolean) => db.enrollment.create({ data: { id: `${P}${id}`, userId: `${P}${user}`, courseId: `${P}${courseId}`, completedAt: done ? new Date() : null } });
    await Promise.all([enr("e1", "t1", "c1", true), enr("e2", "t2", "c1", false), enr("e3", "p1", "c1", true), enr("e4", "s1", "c1", true), enr("e5", "other", "c1", true), enr("e6", "t1", "c2", false), enr("e7", "off", "c1", true)]);

    const s = await getSchoolSummary(`${P}a`);
    assert.equal(s.adults, 3, "two teachers + one school administrator; the disabled one and the other school's teacher are not counted");
    assert.equal(s.students, 2);
    assert.deepEqual(s.members.map((m) => [m.type, m.count]).sort(), [["SCHOOL_ADMIN", 1], ["STUDENT", 2], ["TEACHER", 2]]);
    assert.equal(s.mediaPublished, 1, "only the adults' published media");
    assert.equal(s.coursesPublished, 1, "a draft is not counted");
    assert.equal(s.studentLearners, 1, "students are only a count");
    const c1 = s.courses.find((c) => c.id === `${P}c1`)!;
    assert.deepEqual([c1.enrolled, c1.completed], [3, 2], "adults of this school only: t1 done, t2 not, p1 done (the student, the disabled user and the other school are not in it)");
    assert.deepEqual(c1.audience, ["SCHOOL_ADMIN"]);
    assert.equal(JSON.stringify(s).includes(`${P}t1`), false, "no member id appears in the summary");
    assert.equal(JSON.stringify(s).includes("name"), false, "no personal field is in the summary shape");
    console.log("ok summary counts only, students never listed");

    // a school's own login does not take part in courses
    const r = await enrollAs(`${P}acct`, `${P}c1`);
    assert.ok("error" in r && /บัญชีโรงเรียน/.test(r.error));
    assert.equal(await db.enrollment.count({ where: { userId: `${P}acct` } }), 0);
    console.log("ok school account can not enrol");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
