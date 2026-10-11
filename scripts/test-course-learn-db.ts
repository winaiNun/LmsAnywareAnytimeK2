/* Needs the local database: npm run test:db (creates and removes its own rows: titles start with "zz-learn", usernames "zz.learn.") */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { CourseActor } from "../src/lib/course/access";
import { addBlockAs, addLessonAs, createQuizAs, saveCourseInfoAs, saveQuestionAs, submitCourseAs, updateLessonAs, updateQuizAs } from "../src/lib/course/course-save";
import { accessLesson, confirmLessonAs, quizStatusFor, recomputeProgress, startAttemptAs, submitAttemptAs, touchLessonAs } from "../src/lib/course/course-learn";
import { enrollAs } from "../src/lib/course/course-review";

const db = new PrismaClient();
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const DRIVE = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view";
const T0 = new Date("2026-10-12T10:00:00Z");
const after = (s: number) => new Date(T0.getTime() + s * 1000);

const ok = <T extends object>(r: T | { error: string }): T => { assert.ok(!("error" in r), "error" in r ? r.error : ""); return r as T; };
const fails = (r: object, text: string) => { assert.ok("error" in r, "expected an error containing " + text); assert.ok((r as { error: string }).error.includes(text), `"${(r as { error: string }).error}" should contain "${text}"`); };

async function main() {
  const mk = (n: string, role: "ADMIN" | "TEACHER" | "STUDENT") => db.user.create({ data: { username: `zz.learn.${n}`, name: `zz ${n}`, passwordHash: "x", role } });
  const [adminU, studentU, otherU] = await Promise.all([mk("admin", "ADMIN"), mk("student", "STUDENT"), mk("other", "STUDENT")]);
  const admin: CourseActor = { id: adminU.id, role: "ADMIN", reviewerAreaIds: [] };
  try {
    // ---- a published course: L1 video -> L2 text -> L3 quiz
    const fd = new FormData();
    fd.set("payload", JSON.stringify({ title: "zz-learn คอร์สเรียน", description: "คำอธิบายคอร์สสำหรับทดสอบ", areaId: "area_math", levelIds: [], instructorName: "", hours: 1, enrollOpen: true, cover: { mode: "drive", link: DRIVE, fx: 0.5, fy: 0.5 } }));
    const course = ok(await saveCourseInfoAs(admin, null, fd)).id;
    const l1 = ok(await addLessonAs(admin, course, "บท 1 วิดีโอ")).id;
    const l2 = ok(await addLessonAs(admin, course, "บท 2 อ่าน")).id;
    const l3 = ok(await addLessonAs(admin, course, "บท 3 ทดสอบ")).id;
    for (const l of [l2, l3]) ok(await updateLessonAs(admin, l, { title: l === l2 ? "บท 2 อ่าน" : "บท 3 ทดสอบ", summary: "", unlockRule: "AFTER_PREVIOUS", required: true, sectionTitle: "" }));
    ok(await addBlockAs(admin, l1, { kind: "VIDEO", url: YT })).id;
    const text = ok(await addBlockAs(admin, l2, { kind: "TEXT", text: "อ่านแล้วกดยืนยัน", required: true })).id;
    const quiz = ok(await createQuizAs(admin, course, "zz-learn แบบทดสอบ")).id;
    ok(await updateQuizAs(admin, quiz, { title: "zz-learn แบบทดสอบ", passPercent: 50, maxAttempts: 2, timeLimitMin: null, shuffleQuestions: true, shuffleChoices: true, showAnswers: "AFTER_PASS" }));
    ok(await saveQuestionAs(admin, quiz, null, { type: "TRUEFALSE", points: 1, prompt: "จริงไหม SECRETKEYQ1", config: {}, answerKey: { value: true }, explanation: "SECRET-EXPLANATION" }));
    ok(await saveQuestionAs(admin, quiz, null, { type: "SINGLE", points: 1, prompt: "ข้อ 2", config: { choices: [{ id: "a", text: "ก" }, { id: "b", text: "ข" }] }, answerKey: { correctId: "b" } }));
    ok(await addBlockAs(admin, l3, { kind: "QUIZ", quizId: quiz, required: true }));

    // 1) nothing opens before the course is public and the member is enrolled
    let a = await accessLesson(studentU.id, course, l1);
    assert.ok(!a.ok && a.reason === "not-published");
    ok(await submitCourseAs(admin, course));
    a = await accessLesson(studentU.id, course, l1);
    assert.ok(!a.ok && a.reason === "not-enrolled");
    fails(await confirmLessonAs(studentU.id, course, l1), "ยังไม่ได้ลงทะเบียน");
    ok(await enrollAs(studentU.id, course));
    a = await accessLesson(studentU.id, course, l1);
    assert.ok(a.ok);
    a = await accessLesson(studentU.id, course, l2);
    assert.ok(!a.ok && a.reason === "locked", "lesson 2 waits for lesson 1");
    a = await accessLesson(studentU.id, course, "no_such_lesson");
    assert.ok(!a.ok && a.reason === "no-lesson");
    fails(await confirmLessonAs(studentU.id, course, l2), "บทก่อนหน้า");
    fails(await startAttemptAs(studentU.id, quiz), "บทก่อนหน้า");
    await touchLessonAs(studentU.id, course, l1);
    assert.equal((await db.enrollment.findFirstOrThrow({ where: { userId: studentU.id, courseId: course } })).lastLessonId, l1);

    // 2) a lesson without an unlock question is finished by the confirmation (watching is not measured)
    assert.equal(await db.lessonProgress.count({ where: { userId: studentU.id, lessonId: l1, status: "DONE" } }), 0);
    const c1 = ok(await confirmLessonAs(studentU.id, course, l1));
    assert.deepEqual([c1.done, c1.progress, c1.complete], [true, 33, false]);
    ok(await confirmLessonAs(studentU.id, course, l1)); // twice is harmless
    assert.equal(await db.lessonProgress.count({ where: { userId: studentU.id, lessonId: l1, status: "DONE" } }), 1);

    // 3) two confirmations at the same moment (two tabs) do not break anything
    ok(await enrollAs(otherU.id, course));
    const both = await Promise.all([confirmLessonAs(otherU.id, course, l1), confirmLessonAs(otherU.id, course, l1)]);
    assert.ok(both.every((r) => "ok" in r), JSON.stringify(both));
    assert.equal(await db.lessonProgress.count({ where: { userId: otherU.id, lessonId: l1, status: "DONE" } }), 1);

    // 4) confirming a lesson
    fails(await confirmLessonAs(studentU.id, course, l3), "บทก่อนหน้า");
    const c2 = ok(await confirmLessonAs(studentU.id, course, l2));
    assert.deepEqual([c2.done, c2.progress, c2.complete], [true, 67, false]);
    ok(await confirmLessonAs(studentU.id, course, l2)); // twice is harmless
    fails(await confirmLessonAs(studentU.id, course, l3), "ไม่ต้องกดยืนยัน"); // its unlock question decides

    // 5) the quiz: keys never travel, one open attempt, two tries, reveal only after passing
    const s1 = ok(await startAttemptAs(studentU.id, quiz));
    const json = JSON.stringify(s1.questions);
    for (const secret of ["SECRET-EXPLANATION", "correctId", "answerKey", "\"value\":true"]) assert.equal(json.includes(secret), false, secret);
    assert.equal(s1.questions.length, 2);
    const again = ok(await startAttemptAs(studentU.id, quiz));
    assert.equal(again.attemptId, s1.attemptId, "an open attempt is resumed, not duplicated");
    assert.deepEqual(again.questions.map((x) => x.id), s1.questions.map((x) => x.id), "same seed, same order");
    const tf = s1.questions.find((x) => x.type === "TRUEFALSE")!.id;
    const sg = s1.questions.find((x) => x.type === "SINGLE")!.id;
    fails(await submitAttemptAs(otherU.id, s1.attemptId, {}), "ไม่พบการทำแบบทดสอบ");
    const bad = ok(await submitAttemptAs(studentU.id, s1.attemptId, { [tf]: { value: false }, [sg]: { choiceId: "a" } }));
    assert.equal(bad.outcome.passed, false);
    assert.equal(bad.outcome.percent, 0);
    assert.ok(Object.values(bad.outcome.perQuestion).every((q) => !q.reveal), "no answers shown after a failed attempt");
    fails(await submitAttemptAs(studentU.id, s1.attemptId, {}), "ส่งคำตอบของครั้งนี้ไปแล้ว");
    const s2 = ok(await startAttemptAs(studentU.id, quiz));
    assert.notEqual(s2.attemptId, s1.attemptId);
    assert.equal(s2.attemptNo, 2);
    const racers = await Promise.all([submitAttemptAs(studentU.id, s2.attemptId, { [tf]: { value: true }, [sg]: { choiceId: "b" } }), submitAttemptAs(studentU.id, s2.attemptId, { [tf]: { value: true }, [sg]: { choiceId: "b" } })]);
    assert.equal(racers.filter((r) => "ok" in r).length, 1, "a double submit is graded once");
    const good = racers.find((r) => "ok" in r) as Extract<(typeof racers)[number], { ok: true }>;
    assert.equal(good.outcome.passed, true);
    assert.equal(good.outcome.percent, 100);
    assert.ok(Object.values(good.outcome.perQuestion).every((q) => q.reveal && q.reveal.answer), "answers shown after passing");
    assert.ok(Object.values(good.outcome.perQuestion).some((q) => q.reveal?.explanation === "SECRET-EXPLANATION"));
    assert.equal(good.complete, true);
    fails(await startAttemptAs(studentU.id, quiz), "ครบ 2 ครั้งแล้ว");
    const st = await quizStatusFor(studentU.id, quiz, 2, null);
    assert.deepEqual([st.attempts, st.best, st.passed, st.open], [2, 100, true, null]);

    // 6) course complete: date kept, progress 100
    let enr = await db.enrollment.findFirstOrThrow({ where: { userId: studentU.id, courseId: course } });
    assert.equal(enr.progress, 100);
    assert.ok(enr.completedAt);
    const doneAt = enr.completedAt!.getTime();
    // the author adds a new required lesson later: progress drops, the completion date stays (certificates must not vanish)
    const l4 = ok(await addLessonAs(admin, course, "บท 4 เพิ่มใหม่")).id;
    ok(await addBlockAs(admin, l4, { kind: "TEXT", text: "เนื้อหาใหม่", required: true }));
    const re = await recomputeProgress(studentU.id, course);
    assert.equal(re?.progress, 75);
    assert.equal(re?.complete, false);
    enr = await db.enrollment.findFirstOrThrow({ where: { userId: studentU.id, courseId: course } });
    assert.equal(enr.completedAt?.getTime(), doneAt);

    // 7) time limit: an attempt past the deadline is graded 0; an abandoned one counts as used
    ok(await updateQuizAs(admin, quiz, { title: "zz-learn แบบทดสอบ", passPercent: 50, maxAttempts: 3, timeLimitMin: 1, shuffleQuestions: false, shuffleChoices: false, showAnswers: "AFTER_PASS" }));
    const t1 = ok(await startAttemptAs(studentU.id, quiz)).attemptId;
    await db.quizAttempt.update({ where: { id: t1 }, data: { startedAt: new Date(Date.now() - 5 * 60000) } });
    const late = ok(await submitAttemptAs(studentU.id, t1, { [tf]: { value: true }, [sg]: { choiceId: "b" } }));
    assert.equal(late.expired, true);
    assert.equal(late.outcome.percent, 0, "answers handed in after the deadline do not count");
    fails(await startAttemptAs(studentU.id, quiz), "ครบ 3 ครั้งแล้ว");
    // an attempt that is simply abandoned past its deadline is closed (graded 0) the next time and counts as used
    ok(await updateQuizAs(admin, quiz, { title: "zz-learn แบบทดสอบ", passPercent: 50, maxAttempts: 5, timeLimitMin: 1, shuffleQuestions: false, shuffleChoices: false, showAnswers: "AFTER_PASS" }));
    const t2 = ok(await startAttemptAs(studentU.id, quiz)).attemptId;
    await db.quizAttempt.update({ where: { id: t2 }, data: { startedAt: new Date(Date.now() - 5 * 60000) } });
    const t3 = ok(await startAttemptAs(studentU.id, quiz));
    assert.notEqual(t3.attemptId, t2, "the expired attempt was closed and a fresh one started");
    assert.equal(t3.attemptNo, 5, "the abandoned attempt counted as the fourth");
    fails(await submitAttemptAs(studentU.id, t2, {}), "ส่งคำตอบของครั้งนี้ไปแล้ว");
    console.log("course learn db: 7 groups passed");
  } finally {
    await db.course.deleteMany({ where: { title: { startsWith: "zz-learn" } } });
    await db.user.deleteMany({ where: { username: { startsWith: "zz.learn." } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
