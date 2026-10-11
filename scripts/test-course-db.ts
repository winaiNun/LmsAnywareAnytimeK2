/* Needs the local database: npm run test:db (creates and removes its own rows: titles start with "zz-course", usernames "zz.course.") */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import type { CourseActor } from "../src/lib/course/access";
import { enrollAs, reviewCourseAs, setEnrollOpenAs, unpublishCourseAs } from "../src/lib/course/course-review";
import { addBlockAs, addLessonAs, createQuizAs, deleteBlockAs, deleteCourseAs, deleteLessonAs, deleteQuestionAs, deleteQuizAs, moveBlockAs, moveLessonAs, moveQuestionAs, readinessOf, saveCourseInfoAs, saveQuestionAs, submitCourseAs, updateBlockAs, updateLessonAs, updateQuizAs, withdrawCourseAs } from "../src/lib/course/course-save";

const db = new PrismaClient();
const DRIVE = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view";
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const info = (title: string, extra: object = {}) => {
  const fd = new FormData();
  fd.set("payload", JSON.stringify({ title, description: "คำอธิบายคอร์สสำหรับทดสอบระบบ", areaId: "area_math", levelIds: [], instructorName: "", hours: 2, enrollOpen: true, cover: { mode: "drive", link: DRIVE, fx: 0.5, fy: 0.5 }, ...extra }));
  return fd;
};
const ok = <T extends object>(r: T | { error: string }): T => {
  assert.ok(!("error" in r), "error" in r ? r.error : "");
  return r as T;
};
const fails = (r: { error?: string } | object, text: string) => {
  assert.ok("error" in r && typeof r.error === "string", "expected an error containing " + text);
  assert.ok((r as { error: string }).error.includes(text), `"${(r as { error: string }).error}" should contain "${text}"`);
};

const single = (correct = "a") => ({ type: "SINGLE", points: 2, prompt: "ข้อ?", imageUrl: "", explanation: "", config: { choices: [{ id: "a", text: "ก" }, { id: "b", text: "ข" }] }, answerKey: { correctId: correct } });

async function main() {
  const mk = (n: string, role: "ADMIN" | "TEACHER" | "STUDENT", creatorStatus: "NONE" | "APPROVED" = "NONE") =>
    db.user.create({ data: { username: `zz.course.${n}`, name: `zz ${n}`, passwordHash: "x", role, creatorStatus } });
  const [adminU, teacherU, otherU, creatorStudentU] = await Promise.all([mk("admin", "ADMIN"), mk("teacher", "TEACHER"), mk("other", "STUDENT"), mk("creator", "STUDENT", "APPROVED")]);
  const A = (u: { id: string; role: string }, creatorStatus = "NONE", reviewerAreaIds: string[] = []): CourseActor => ({ id: u.id, role: u.role, creatorStatus, reviewerAreaIds });
  const admin = A(adminU);
  const teacher = A(teacherU);
  const other = A(otherU);
  const stu = A(creatorStudentU, "APPROVED");
  try {
    // 1) who may create; area and title are checked; a new course is a draft with its levels and cover
    fails(await saveCourseInfoAs(other, null, info("zz-course ไม่มีสิทธิ์")), "ยังไม่มีสิทธิ์สร้างคอร์ส");
    fails(await saveCourseInfoAs(teacher, null, info("ab")), "อย่างน้อย 3");
    fails(await saveCourseInfoAs(teacher, null, info("zz-course พื้นที่", { areaId: "area_nope" })), "ไม่พบกลุ่มสาระ");
    fails(await saveCourseInfoAs(teacher, null, info("zz-course ลิงก์ปก", { cover: { mode: "drive", link: "https://example.com/x" } })), "drive.google.com");
    fails(await saveCourseInfoAs(teacher, null, info("zz-course อัปโหลด", { cover: { mode: "upload", fx: 0.5, fy: 0.5 } })), "ปิดการอัปโหลด");
    const c1 = ok(await saveCourseInfoAs(teacher, null, info("zz-course หนึ่ง", { levelIds: ["level_primary"] })));
    assert.equal(c1.status, "DRAFT");
    ok(await saveCourseInfoAs(stu, null, info("zz-course ผู้สร้างที่เป็นนักเรียน")));
    const row = await db.course.findUniqueOrThrow({ where: { id: c1.id }, include: { levels: true } });
    assert.equal(row.coverDriveId, "1AbCdEfGhIjKlMnOpQrStUvWxYz012345");
    assert.equal(row.levels.length, 1);
    fails(await saveCourseInfoAs(other, c1.id, info("zz-course แก้ของคนอื่น")), "ไม่มีสิทธิ์");

    // 2) lessons: add, validate, order, sections
    const l1 = ok(await addLessonAs(teacher, c1.id, "บทที่ 1")).id;
    const l2 = ok(await addLessonAs(teacher, c1.id, "บทที่ 2")).id;
    const l3 = ok(await addLessonAs(teacher, c1.id, "บทที่ 3")).id;
    fails(await addLessonAs(teacher, c1.id, "  "), "ชื่อบทเรียน");
    fails(await addLessonAs(other, c1.id, "แทรก"), "ไม่มีสิทธิ์");
    const pos = async () => (await db.lesson.findMany({ where: { courseId: c1.id }, orderBy: { position: "asc" } })).map((l) => l.title);
    assert.deepEqual(await pos(), ["บทที่ 1", "บทที่ 2", "บทที่ 3"]);
    ok(await moveLessonAs(teacher, l3, "up"));
    assert.deepEqual(await pos(), ["บทที่ 1", "บทที่ 3", "บทที่ 2"]);
    ok(await moveLessonAs(teacher, l1, "up")); // already first: nothing changes, no error
    assert.deepEqual(await pos(), ["บทที่ 1", "บทที่ 3", "บทที่ 2"]);
    ok(await updateLessonAs(teacher, l2, { title: "บทที่ 2 (แก้)", summary: "สรุป", unlockRule: "AFTER_PREVIOUS", required: false, sectionTitle: "ตอนที่ 1" }));
    ok(await updateLessonAs(teacher, l3, { title: "บทที่ 3", summary: "", unlockRule: "OPEN", required: true, sectionTitle: "ตอนที่ 1" }));
    assert.equal(await db.courseSection.count({ where: { courseId: c1.id } }), 1, "same heading text = one section");
    const lesson2 = await db.lesson.findUniqueOrThrow({ where: { id: l2 } });
    assert.equal(lesson2.unlockRule, "AFTER_PREVIOUS");
    assert.equal(lesson2.required, false);
    ok(await updateLessonAs(teacher, l2, { title: "บทที่ 2 (แก้)", summary: "", unlockRule: "OPEN", required: true, sectionTitle: "" }));
    ok(await updateLessonAs(teacher, l3, { title: "บทที่ 3", summary: "", unlockRule: "OPEN", required: true, sectionTitle: "" }));
    assert.equal(await db.courseSection.count({ where: { courseId: c1.id } }), 0, "a heading nobody uses is removed");
    fails(await updateLessonAs(teacher, l2, { title: "", summary: "", unlockRule: "OPEN", required: true, sectionTitle: "" }), "ชื่อบทเรียน");

    // 3) blocks
    const quiz = ok(await createQuizAs(teacher, c1.id, "zz-course แบบทดสอบ")).id;
    const otherCourse = ok(await saveCourseInfoAs(teacher, null, info("zz-course สอง")));
    const otherQuiz = ok(await createQuizAs(teacher, otherCourse.id, "zz-course ของคอร์สอื่น")).id;
    const v = ok(await addBlockAs(teacher, l1, { kind: "VIDEO", label: "วิดีโอ", url: YT, required: true, minPercent: 80 })).id;
    fails(await addBlockAs(teacher, l1, { kind: "VIDEO", url: "https://www.youtube.com/playlist?list=PLabc123456789" }), "เพลย์ลิสต์");
    fails(await addBlockAs(teacher, l1, { kind: "VIDEO", url: "https://vimeo.com/123456" }), "YouTube");
    fails(await addBlockAs(teacher, l1, { kind: "VIDEO", url: YT, minPercent: 5 }), "10–100");
    ok(await addBlockAs(teacher, l1, { kind: "LINK", url: DRIVE }));
    fails(await addBlockAs(teacher, l1, { kind: "LINK", url: "javascript:alert(1)" }), "https");
    fails(await addBlockAs(teacher, l1, { kind: "LINK", url: "http://example.com" }), "https");
    ok(await addBlockAs(teacher, l1, { kind: "TEXT", text: "## หัวข้อ\n- ข้อ 1" }));
    fails(await addBlockAs(teacher, l1, { kind: "TEXT", text: "   " }), "พิมพ์ข้อความ");
    fails(await addBlockAs(teacher, l1, { kind: "MEDIA", mediaId: "no_such_media" }), "ไม่พบสื่อ");
    fails(await addBlockAs(teacher, l1, { kind: "MEDIA" }), "เลือกสื่อ");
    fails(await addBlockAs(teacher, l1, { kind: "QUIZ", quizId: otherQuiz }), "ไม่พบแบบทดสอบ");
    const qb = ok(await addBlockAs(teacher, l2, { kind: "QUIZ", quizId: quiz, required: true })).id;
    fails(await addBlockAs(other, l1, { kind: "TEXT", text: "x" }), "ไม่มีสิทธิ์");
    const published = await db.media.findFirst({ where: { status: "PUBLISHED" }, select: { id: true } });
    if (published) ok(await addBlockAs(teacher, l3, { kind: "MEDIA", mediaId: published.id }));
    fails(await updateBlockAs(teacher, v, { kind: "TEXT", text: "เปลี่ยนชนิด" }), "เปลี่ยนชนิด");
    ok(await updateBlockAs(teacher, v, { kind: "VIDEO", url: YT, required: true, minPercent: 95 }));
    assert.equal((await db.lessonBlock.findUniqueOrThrow({ where: { id: v } })).minPercent, 95);
    const order = async () => (await db.lessonBlock.findMany({ where: { lessonId: l1 }, orderBy: { sortOrder: "asc" } })).map((b) => b.kind);
    assert.deepEqual(await order(), ["VIDEO", "LINK", "TEXT"]);
    ok(await moveBlockAs(teacher, v, "down"));
    assert.deepEqual(await order(), ["LINK", "VIDEO", "TEXT"]);
    for (let i = 0; i < 17; i++) ok(await addBlockAs(teacher, l1, { kind: "TEXT", text: `ข้อความ ${i}` }));
    fails(await addBlockAs(teacher, l1, { kind: "TEXT", text: "เกินลิมิต" }), "ไม่เกิน 20");

    // 4) quiz settings and questions
    ok(await updateQuizAs(teacher, quiz, { title: "แบบทดสอบ", passPercent: 70, maxAttempts: 3, timeLimitMin: null, shuffleQuestions: true, shuffleChoices: true, showAnswers: "AFTER_PASS" }));
    fails(await updateQuizAs(teacher, quiz, { title: "x", passPercent: 0, maxAttempts: null, timeLimitMin: null, shuffleQuestions: false, shuffleChoices: false, showAnswers: "NEVER" }), "1–100");
    fails(await updateQuizAs(teacher, quiz, { title: "x", passPercent: 60, maxAttempts: 99, timeLimitMin: null, shuffleQuestions: false, shuffleChoices: false, showAnswers: "NEVER" }), "1–50");
    const q1 = ok(await saveQuestionAs(teacher, quiz, null, single())).id;
    fails(await saveQuestionAs(teacher, quiz, null, single("zzz")), "หนึ่งในตัวเลือก");
    fails(await saveQuestionAs(teacher, quiz, null, { ...single(), prompt: "  " }), "พิมพ์คำถาม");
    fails(await saveQuestionAs(teacher, quiz, null, { ...single(), points: 0 }), "1–100");
    fails(await saveQuestionAs(teacher, quiz, null, { ...single(), imageUrl: "http://example.com/x.png" }), "https");
    fails(await saveQuestionAs(other, quiz, null, single()), "ไม่มีสิทธิ์");
    const withImg = ok(await saveQuestionAs(teacher, quiz, null, { ...single(), imageUrl: DRIVE })).id;
    assert.ok((await db.question.findUniqueOrThrow({ where: { id: withImg } })).imageUrl?.startsWith("https://drive.google.com/thumbnail?id="), "a Drive link becomes its thumbnail address");
    const q3 = ok(await saveQuestionAs(teacher, quiz, null, { type: "TRUEFALSE", points: 1, prompt: "จริงไหม", config: {}, answerKey: { value: true } })).id;
    ok(await saveQuestionAs(teacher, quiz, q1, { ...single("b"), prompt: "ข้อ? (แก้)" }));
    assert.equal((await db.question.findUniqueOrThrow({ where: { id: q1 } })).prompt, "ข้อ? (แก้)");
    fails(await saveQuestionAs(teacher, quiz, "no_such_question", single()), "ไม่พบ");
    const qorder = async () => (await db.question.findMany({ where: { quizId: quiz }, orderBy: { sortOrder: "asc" } })).map((q) => q.id);
    assert.deepEqual(await qorder(), [q1, withImg, q3]);
    ok(await moveQuestionAs(teacher, q3, "up"));
    assert.deepEqual(await qorder(), [q1, q3, withImg]);
    ok(await deleteQuestionAs(teacher, withImg));
    assert.deepEqual(await qorder(), [q1, q3]);

    // 5) a quiz used in a lesson can not be deleted; one that was attempted either
    fails(await deleteQuizAs(teacher, quiz), "ถูกใช้อยู่");
    ok(await deleteQuizAs(teacher, otherQuiz));
    fails(await deleteQuizAs(teacher, "no_quiz"), "ไม่พบ");

    // 6) readiness, sending for review
    const bad = await readinessOf(otherCourse.id);
    assert.ok(bad.some((m) => m.includes("บทเรียนอย่างน้อย 1")));
    fails(await submitCourseAs(teacher, otherCourse.id), "บทเรียนอย่างน้อย 1");
    fails(await submitCourseAs(other, c1.id), "ไม่มีสิทธิ์");
    ok(await saveQuestionAs(teacher, quiz, null, { ...single(), type: "MULTI", config: { choices: [{ id: "a", text: "ก" }, { id: "b", text: "ข" }], scoring: "all" }, answerKey: { correctIds: ["a"] } }));
    // break a question straight in the database: the course must not be sendable
    await db.question.update({ where: { id: q3 }, data: { answerKey: {} } });
    fails(await submitCourseAs(teacher, c1.id), "เฉลยไม่ครบ");
    await db.question.update({ where: { id: q3 }, data: { answerKey: { value: true } } });
    const sent = ok(await submitCourseAs(teacher, c1.id));
    assert.equal(sent.status, "PENDING");
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: c1.id } })).status, "PENDING");

    // 7) withdraw; editing a live course sends it back to the queue (and the first publish date is kept)
    ok(await withdrawCourseAs(teacher, c1.id));
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: c1.id } })).status, "DRAFT");
    fails(await withdrawCourseAs(teacher, c1.id), "ที่รอตรวจ");
    await db.course.update({ where: { id: c1.id }, data: { status: "PUBLISHED", publishedAt: new Date("2026-01-01T00:00:00Z"), reviewNote: "เดิม" } });
    ok(await updateLessonAs(teacher, l1, { title: "บทที่ 1 (แก้หลังเผยแพร่)", summary: "", unlockRule: "OPEN", required: true, sectionTitle: "" }));
    let c = await db.course.findUniqueOrThrow({ where: { id: c1.id } });
    assert.equal(c.status, "PENDING", "an author's edit of a live course needs a new review");
    assert.equal(c.reviewNote, null);
    assert.equal(c.publishedAt?.toISOString(), "2026-01-01T00:00:00.000Z");
    await db.course.update({ where: { id: c1.id }, data: { status: "REJECTED", reviewNote: "แก้ไขหน่อย" } });
    ok(await updateLessonAs(teacher, l1, { title: "บทที่ 1", summary: "", unlockRule: "OPEN", required: true, sectionTitle: "" }));
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: c1.id } })).status, "DRAFT", "fixing a rejected course makes it a draft again");

    // 8) an admin publishes straight away, and an admin's edit keeps it published
    const adminCourse = ok(await saveCourseInfoAs(admin, null, info("zz-course แอดมิน")));
    const al = ok(await addLessonAs(admin, adminCourse.id, "บท")).id;
    ok(await addBlockAs(admin, al, { kind: "TEXT", text: "เนื้อหา" }));
    const pub = ok(await submitCourseAs(admin, adminCourse.id));
    assert.equal(pub.status, "PUBLISHED");
    const pc = await db.course.findUniqueOrThrow({ where: { id: adminCourse.id } });
    assert.ok(pc.publishedAt && pc.reviewedById === adminU.id);
    ok(await updateLessonAs(admin, al, { title: "บท (แก้)", summary: "", unlockRule: "OPEN", required: true, sectionTitle: "" }));
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: adminCourse.id } })).status, "PUBLISHED");
    ok(await saveCourseInfoAs(admin, adminCourse.id, info("zz-course แอดมิน (แก้)")));
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: adminCourse.id } })).status, "PUBLISHED");
    // a teacher's own live course can not be deleted by them; with learners nobody can delete it
    await db.course.update({ where: { id: otherCourse.id }, data: { status: "PUBLISHED" } });
    fails(await deleteCourseAs(teacher, otherCourse.id), "ติดต่อผู้ดูแลระบบ");
    await db.enrollment.create({ data: { userId: otherU.id, courseId: adminCourse.id } });
    fails(await deleteCourseAs(admin, adminCourse.id), "ผู้ลงทะเบียน");
    await db.enrollment.deleteMany({ where: { courseId: adminCourse.id } });

    // 9) deleting lessons renumbers; deleting a course removes its parts
    ok(await deleteLessonAs(teacher, l1));
    assert.deepEqual(await pos(), ["บทที่ 3", "บทที่ 2 (แก้)"]);
    assert.deepEqual((await db.lesson.findMany({ where: { courseId: c1.id }, orderBy: { position: "asc" } })).map((l) => l.position), [1, 2]);
    ok(await deleteBlockAs(teacher, qb));
    ok(await deleteQuizAs(teacher, quiz));
    ok(await deleteCourseAs(teacher, c1.id));
    assert.equal(await db.lesson.count({ where: { courseId: c1.id } }), 0);
    assert.equal(await db.question.count({ where: { quizId: quiz } }), 0);
    ok(await deleteCourseAs(admin, otherCourse.id));
    ok(await deleteCourseAs(admin, adminCourse.id));

    // 10) review: approve / send back, never your own, a note is required to send back
    const rc = ok(await saveCourseInfoAs(teacher, null, info("zz-course ตรวจ")));
    const rl = ok(await addLessonAs(teacher, rc.id, "บท")).id;
    ok(await addBlockAs(teacher, rl, { kind: "TEXT", text: "เนื้อหา" }));
    ok(await submitCourseAs(teacher, rc.id));
    const reviewer = A(otherU, "NONE", ["area_math"]);
    const wrongArea = A(otherU, "NONE", ["area_thai"]);
    fails(await reviewCourseAs(wrongArea, rc.id, "approve", ""), "ไม่มีสิทธิ์ตรวจ");
    fails(await reviewCourseAs(A(teacherU, "APPROVED", ["area_math"]), rc.id, "approve", ""), "ของตัวเอง");
    fails(await reviewCourseAs(reviewer, rc.id, "reject", "สั้น"), "5 ตัวอักษร");
    ok(await reviewCourseAs(reviewer, rc.id, "reject", "ภาพปกไม่ชัด ช่วยเปลี่ยนด้วย"));
    let rr = await db.course.findUniqueOrThrow({ where: { id: rc.id } });
    assert.equal(rr.status, "REJECTED");
    assert.equal(rr.reviewNote, "ภาพปกไม่ชัด ช่วยเปลี่ยนด้วย");
    fails(await reviewCourseAs(reviewer, rc.id, "approve", ""), "รออนุมัติ");
    ok(await submitCourseAs(teacher, rc.id)); // rejected courses can be sent again
    ok(await reviewCourseAs(reviewer, rc.id, "approve", ""));
    rr = await db.course.findUniqueOrThrow({ where: { id: rc.id } });
    assert.equal(rr.status, "PUBLISHED");
    assert.ok(rr.publishedAt && rr.reviewedAt && rr.reviewedById === otherU.id);

    // 11) enrolment: only public + open courses, twice is harmless, closing stops new learners only
    fails(await enrollAs(otherU.id, "no_such_course"), "ไม่พบคอร์ส");
    fails(await enrollAs(otherU.id, c1.id), "ไม่พบคอร์ส"); // c1 was deleted above; a draft is not public either
    const e1 = ok(await enrollAs(otherU.id, rc.id));
    assert.equal(e1.already, false);
    const e2 = ok(await enrollAs(otherU.id, rc.id));
    assert.equal(e2.already, true);
    const both = await Promise.all([enrollAs(creatorStudentU.id, rc.id), enrollAs(creatorStudentU.id, rc.id)]);
    assert.ok(both.every((r) => !("error" in r)), "two clicks at once do not fail");
    assert.equal(await db.enrollment.count({ where: { courseId: rc.id } }), 2);
    fails(await setEnrollOpenAs(other, rc.id, false), "ไม่มีสิทธิ์");
    ok(await setEnrollOpenAs(teacher, rc.id, false));
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: rc.id } })).status, "PUBLISHED", "closing sign-ups needs no new review");
    fails(await enrollAs(teacherU.id, rc.id), "ปิดรับลงทะเบียน");
    ok(await enrollAs(otherU.id, rc.id)); // someone already in can still "join" (nothing changes)
    ok(await setEnrollOpenAs(admin, rc.id, true));

    // 12) unpublish is admin-only and keeps the learners
    fails(await unpublishCourseAs(teacher, rc.id), "ไม่มีสิทธิ์");
    ok(await unpublishCourseAs(admin, rc.id));
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: rc.id } })).status, "DRAFT");
    assert.equal(await db.enrollment.count({ where: { courseId: rc.id } }), 2);
    fails(await unpublishCourseAs(admin, rc.id), "ไม่ได้เผยแพร่");
    fails(await enrollAs(creatorStudentU.id, rc.id), "ไม่พบคอร์ส");
    console.log("course db: 12 groups passed");
  } finally {
    await db.course.deleteMany({ where: { OR: [{ title: { startsWith: "zz-course" } }, { createdById: { in: [adminU.id, teacherU.id, otherU.id, creatorStudentU.id] } }] } });
    await db.user.deleteMany({ where: { username: { startsWith: "zz.course." } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
