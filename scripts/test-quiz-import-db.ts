// Saving imported questions against the real (local) database. Run: npx tsx --env-file=.env scripts/test-quiz-import-db.ts
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import type { CourseActor } from "../src/lib/course/access";
import { importQuestionsAs } from "../src/lib/course/course-save";
import { parseQuizSheet } from "../src/lib/course/quiz/import";
import { parseQuestion } from "../src/lib/course/quiz/schemas";

const H = ["คำถาม", "ตัวเลือก ก", "ตัวเลือก ข", "ตัวเลือก ค", "เฉลย", "คะแนน", "คำอธิบายเฉลย"];
const stamp = Date.now();

async function main() {
  const area = await db.learningArea.findFirstOrThrow();
  let n = 0;
  const mk = (name: string, role: "TEACHER" | "ADMIN") => db.user.create({ data: { name, email: `qi-${n++}-${stamp}@test.local`, passwordHash: "x", role } });
  const teacher = await mk("ผู้สอน นำเข้า", "TEACHER");
  const other = await mk("ผู้สอน อื่น", "TEACHER");
  const T: CourseActor = { id: teacher.id, role: "TEACHER", creatorStatus: "APPROVED", reviewerAreaIds: [] };
  const O: CourseActor = { id: other.id, role: "TEACHER", creatorStatus: "APPROVED", reviewerAreaIds: [] };
  const course = await db.course.create({ data: { title: "ทดสอบนำเข้าข้อสอบ", areaId: area.id, createdById: teacher.id, status: "PUBLISHED" } });
  const quiz = await db.quiz.create({ data: { courseId: course.id, title: "ชุดทดสอบ" } });
  try {
    // one question typed by hand first: the import goes after it
    await db.question.create({ data: { quizId: quiz.id, type: "TRUEFALSE", points: 1, prompt: "ข้อเดิม", config: {}, answerKey: { value: true }, sortOrder: 1 } });

    const sheet = parseQuizSheet([H, ["เมืองหลวงไทย", "กรุงเทพ", "เชียงใหม่", "ภูเก็ต", "ก", "2", "เพราะเป็นเมืองหลวง"], ["ภาคเหนือ", "เชียงใหม่", "ลำปาง", "ระยอง", "ก,ข", "", ""], ["เฉลยผิด", "a", "b", "", "ฮ", "", ""]]);
    assert.ok(sheet.ok);
    if (!sheet.ok) return;
    assert.equal(sheet.valid, 2);
    const inputs = sheet.rows.filter((r) => r.question).map((r) => r.question);

    // only the author (or an admin) may import
    assert.equal("error" in (await importQuestionsAs(O, quiz.id, inputs)), true, "another teacher cannot");
    assert.equal("error" in (await importQuestionsAs(T, "no-such-quiz", inputs)), true);
    assert.equal("error" in (await importQuestionsAs(T, quiz.id, [])), true, "nothing to import");
    assert.equal("error" in (await importQuestionsAs(T, quiz.id, "x")), true);

    // 2 good + 1 short-answer (not allowed here) + 1 broken shape -> 2 saved, 2 reported with their index
    const bad = { type: "SHORT", points: 1, prompt: "เติมคำ", imageUrl: "", explanation: "", config: {}, answerKey: { accepted: ["x"] } };
    const broken = { type: "SINGLE", points: 1, prompt: "", imageUrl: "", explanation: "", config: {}, answerKey: {} };
    const r = await importQuestionsAs(T, quiz.id, [inputs[0], bad, inputs[1], broken]);
    assert.ok("ok" in r && r.ok);
    if (!("ok" in r)) return;
    assert.equal(r.imported, 2);
    assert.deepEqual(r.skipped.map((s) => s.index), [1, 3]);
    assert.ok(r.skipped[0].error.includes("ปรนัย"));

    const saved = await db.question.findMany({ where: { quizId: quiz.id }, orderBy: { sortOrder: "asc" } });
    assert.deepEqual(saved.map((q) => q.prompt), ["ข้อเดิม", "เมืองหลวงไทย", "ภาคเหนือ"], "added after the existing question, in file order");
    assert.deepEqual(saved.map((q) => q.sortOrder), [1, 2, 3]);
    assert.equal(saved[1].type, "SINGLE");
    assert.equal(saved[1].points, 2);
    assert.equal(saved[1].explanation, "เพราะเป็นเมืองหลวง");
    assert.equal(saved[2].type, "MULTI");
    assert.ok(saved.slice(1).every((q) => parseQuestion(q.type, q.config, q.answerKey).ok), "the quiz builder accepts what was imported");
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: course.id } })).status, "PENDING", "editing a live course sends it back to review, like any other edit");

    // the 100-question ceiling counts the questions already there
    await db.question.createMany({ data: Array.from({ length: 95 }, (_, i) => ({ quizId: quiz.id, type: "TRUEFALSE" as const, points: 1, prompt: `เติม ${i}`, config: {}, answerKey: { value: true }, sortOrder: 10 + i })) });
    const full = await importQuestionsAs(T, quiz.id, [inputs[0], inputs[1], inputs[0], inputs[1], inputs[0], inputs[1]]);
    assert.ok("error" in full && full.error.includes("อีกไม่เกิน 2"), "98 + 6 > 100 is refused with the room left");
    assert.equal(await db.question.count({ where: { quizId: quiz.id } }), 98, "all or nothing at the ceiling");
    const exact = await importQuestionsAs(T, quiz.id, [inputs[0], inputs[1]]);
    assert.ok("ok" in exact && exact.imported === 2);
    assert.equal(await db.question.count({ where: { quizId: quiz.id } }), 100);

    console.log("quiz import (db): all groups passed");
  } finally {
    await db.course.deleteMany({ where: { id: course.id } });
    await db.user.deleteMany({ where: { id: { in: [teacher.id, other.id] } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
