/* Needs the local database: npm run test:db (creates rows whose ids start with "zzstat" and removes them). Every number is checked as a CHANGE from what the database already holds. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { computeStats } from "../src/lib/stats/compute";
import { STAT_METRIC_KEYS, type StatMetric } from "../src/lib/stats/metrics";

const db = new PrismaClient();
const P = "zzstat";

async function cleanup() {
  await db.certificate.deleteMany({ where: { id: { startsWith: P } } });
  await db.certificateDesign.deleteMany({ where: { id: { startsWith: P } } });
  await db.enrollment.deleteMany({ where: { id: { startsWith: P } } });
  await db.course.deleteMany({ where: { id: { startsWith: P } } });
  await db.media.deleteMany({ where: { id: { startsWith: P } } });
  await db.school.deleteMany({ where: { id: { startsWith: P } } });
  await db.user.deleteMany({ where: { id: { startsWith: P } } });
}

const delta = (after: Record<string, number>, before: Record<string, number>) => Object.fromEntries(STAT_METRIC_KEYS.map((k) => [k, after[k] - before[k]])) as Record<StatMetric, number>;

async function main() {
  await cleanup();
  try {
    const area = await db.learningArea.findFirstOrThrow({ select: { id: true } });
    const before = await computeStats(STAT_METRIC_KEYS);
    for (const k of STAT_METRIC_KEYS) assert.ok(Number.isInteger(before[k]) && before[k] >= 0, `${k} is a count`);
    console.log("ok every metric counts");

    // people: teacher A owns published media AND a published course; teacher B only published media; teacher C only a draft;
    // a student owns published media (hidden); a disabled teacher owns published media; a supervisor owns a published course
    const mk = (id: string, memberType: "STUDENT" | "TEACHER" | "SUPERVISOR" | "GENERAL", active = true) => db.user.create({ data: { id: `${P}_${id}`, name: `zz ${id}`, username: `zz.stat.${id}`, passwordHash: "x", memberType, active } });
    const [tA, tB, tC, stu, off, sup, stu2, gen] = await Promise.all([mk("a", "TEACHER"), mk("b", "TEACHER"), mk("c", "TEACHER"), mk("stu", "STUDENT"), mk("off", "TEACHER", false), mk("sup", "SUPERVISOR"), mk("stu2", "STUDENT"), mk("gen", "GENERAL")]);
    const media = (id: string, by: string, status: "PUBLISHED" | "DRAFT" | "PENDING") => db.media.create({ data: { id: `${P}_${id}`, title: `zz ${id}`, areaId: area.id, createdById: by, status, publishedAt: status === "PUBLISHED" ? new Date() : null } });
    await media("m1", tA.id, "PUBLISHED");
    await media("m2", tA.id, "PUBLISHED"); // same owner twice = one creator
    await media("m3", tB.id, "PUBLISHED");
    await media("m4", tC.id, "DRAFT");
    await media("m5", stu.id, "PUBLISHED");
    await media("m6", off.id, "PUBLISHED");
    await media("m7", tC.id, "PENDING");
    const course = (id: string, by: string, status: "PUBLISHED" | "DRAFT") => db.course.create({ data: { id: `${P}_${id}`, title: `zz ${id}`, areaId: area.id, createdById: by, status, publishedAt: status === "PUBLISHED" ? new Date() : null } });
    const c1 = await course("c1", tA.id, "PUBLISHED");
    const c2 = await course("c2", sup.id, "PUBLISHED");
    const c3 = await course("c3", tC.id, "DRAFT");

    let d = delta(await computeStats(STAT_METRIC_KEYS), before);
    assert.equal(d.media, 5, "5 published media (drafts and pending are not counted)");
    assert.equal(d.courses, 2, "2 published courses (the draft is not counted)");
    assert.equal(d.mediaCreators, 2, "teacher A (twice = once) and B; not the student, the disabled teacher or the draft owner");
    assert.equal(d.instructors, 2, "teacher A and the supervisor");
    assert.equal(d.creators, 3, "A, B, supervisor: A owns both media and a course but counts once");
    assert.equal(d.students, 2, "two active students");
    assert.equal(d.members, 7, "everyone active: 8 created minus the disabled one");
    console.log("ok media, courses, creators, people");

    // learners: student 1 enrols in both published courses and the draft; student 2 only in the draft; the general member in one published course;
    // the disabled teacher in one published course (does not count)
    const enrol = (id: string, userId: string, courseId: string) => db.enrollment.create({ data: { id: `${P}_${id}`, userId, courseId } });
    await enrol("e1", stu.id, c1.id);
    await enrol("e2", stu.id, c2.id);
    await enrol("e3", stu.id, c3.id);
    await enrol("e4", stu2.id, c3.id);
    await enrol("e5", gen.id, c1.id);
    await enrol("e6", off.id, c1.id);
    d = delta(await computeStats(STAT_METRIC_KEYS), before);
    assert.equal(d.learners, 2, "student 1 (two courses = once) and the general member; draft-only and disabled learners are out");
    assert.equal(d.enrollments, 4, "4 enrolments in published courses (e1, e2, e5, e6): the draft's are out, a person with two counts twice");
    console.log("ok learners and enrolments");

    // certificates: only ISSUED counts
    const design = await db.certificateDesign.create({ data: { id: `${P}_d1`, courseId: c1.id, name: "zz" } });
    const cert = (id: string, userId: string, status: "PENDING" | "ISSUED" | "REVOKED") => db.certificate.create({ data: { id: `${P}_${id}`, courseId: c1.id, userId, designId: design.id, status, verifyCode: `${P}-${id}`, completedAt: new Date(), issuedAt: status === "ISSUED" ? new Date() : null } });
    await cert("k1", stu.id, "ISSUED");
    await cert("k2", gen.id, "PENDING");
    await cert("k3", off.id, "REVOKED");
    d = delta(await computeStats(STAT_METRIC_KEYS), before);
    assert.equal(d.certificates, 1, "one issued certificate");
    console.log("ok certificates");

    // schools: only the shown ones
    await db.school.create({ data: { id: `${P}_s1`, code: `${P}01`, name: "zz โรงเรียน", district: "zz", center: "zz", active: true } });
    await db.school.create({ data: { id: `${P}_s2`, code: `${P}02`, name: "zz ซ่อน", district: "zz", center: "zz", active: false } });
    d = delta(await computeStats(STAT_METRIC_KEYS), before);
    assert.equal(d.schools, 1, "one shown school");
    console.log("ok schools");

    // a subset is counted on its own, and a repeated key is fine
    const some = await computeStats(["media", "media", "students"]);
    assert.deepEqual(Object.keys(some).sort(), ["media", "students"]);
    assert.equal(some.media - before.media, 5);
    assert.deepEqual(await computeStats([]), {});
    console.log("ok subsets");

    // the migration left the four starter cards
    const starters = await db.statCard.findMany({ where: { id: { startsWith: "stat_default_" } }, orderBy: { sortOrder: "asc" } });
    if (starters.length) assert.deepEqual(starters.map((s) => s.metric), ["media", "courses", "creators", "students"]);
    console.log("ok starter cards", starters.length ? "(present)" : "(removed by the admin)");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
