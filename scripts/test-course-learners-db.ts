// Learner list of a course against the real (local) database. Run: npx tsx --env-file=.env scripts/test-course-learners-db.ts
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { allLearners, listLearners } from "../src/lib/course/course-learners";

async function main() {
  const area = await db.learningArea.findFirstOrThrow();
  const author = await db.user.create({ data: { name: "ผู้สอน ทดสอบ", email: `t-${Date.now()}@test.local`, passwordHash: "x", role: "TEACHER" } });
  const course = await db.course.create({ data: { title: "ทดสอบรายชื่อผู้เรียน", areaId: area.id, createdById: author.id, status: "PUBLISHED" } });
  const people = await Promise.all(
    ["นายสมชาย ใจดี", "นางสาวสมหญิง รักเรียน", "นายวินัย หนุนกระโทก", "นางมาลี สุขใจ"].map((name, i) =>
      db.user.create({ data: { name, email: `l${i}-${Date.now()}@test.local`, passwordHash: "x", organization: i === 3 ? "สพป.ทดสอบ" : null } })),
  );
  try {
    await db.enrollment.createMany({
      data: [
        { userId: people[0].id, courseId: course.id, progress: 100, completedAt: new Date() },
        { userId: people[1].id, courseId: course.id, progress: 40 },
        { userId: people[2].id, courseId: course.id, progress: 0 },
        { userId: people[3].id, courseId: course.id, progress: 100, completedAt: new Date() },
      ],
    });

    const all = await listLearners(course.id, {});
    assert.deepEqual(all.counts, { all: 4, done: 2, learning: 1, new: 1 });
    assert.equal(all.total, 4);

    assert.equal((await listLearners(course.id, { status: "done" })).total, 2);
    assert.equal((await listLearners(course.id, { status: "learning" })).rows[0].user.name, "นางสาวสมหญิง รักเรียน");
    assert.equal((await listLearners(course.id, { status: "new" })).rows[0].user.name, "นายวินัย หนุนกระโทก");

    assert.equal((await listLearners(course.id, { q: "วินัย" })).total, 1, "search by name");
    assert.equal((await listLearners(course.id, { q: "สพป.ทดสอบ" })).total, 1, "search by agency");
    assert.equal((await listLearners(course.id, { q: "ไม่มีคนนี้" })).total, 0);
    assert.equal((await listLearners(course.id, { q: "สม", status: "done" })).total, 1, "search + status together");

    assert.equal((await listLearners(course.id, { page: 2 })).rows.length, 0, "page 2 is empty with 4 learners");
    assert.equal((await allLearners(course.id, {})).length, 4);
    assert.equal((await allLearners(course.id, { status: "done" })).length, 2);

    // another course's learners never leak in
    const other = await db.course.create({ data: { title: "คอร์สอื่น", areaId: area.id, createdById: author.id } });
    assert.equal((await listLearners(other.id, {})).counts.all, 0);
    await db.course.delete({ where: { id: other.id } });
    console.log("course learners (db): all groups passed");
  } finally {
    await db.course.delete({ where: { id: course.id } });
    await db.user.deleteMany({ where: { id: { in: [author.id, ...people.map((p) => p.id)] } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
