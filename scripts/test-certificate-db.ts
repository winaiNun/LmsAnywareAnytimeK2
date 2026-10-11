// Certificates against the real (local) database. Run: npx tsx --env-file=.env scripts/test-certificate-db.ts
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import type { CourseActor } from "../src/lib/course/access";
import { addFont, createDesign, deleteDesign, deleteSerial, ensureCertificate, issueNumbers, restoreCertificate, revokeCertificate, saveDesign, saveSerial, scoreOf } from "../src/lib/certificate/cert-store";
import { defaultFields } from "../src/lib/certificate/schema";

const stamp = Date.now();

async function main() {
  const area = await db.learningArea.findFirstOrThrow();
  let n = 0;
  const mk = (name: string, role: "ADMIN" | "TEACHER" | "STUDENT" = "STUDENT") => db.user.create({ data: { name, email: `c-${n++}-${stamp}@test.local`, passwordHash: "x", role } });
  const admin = await mk("แอดมิน ทดสอบ", "ADMIN");
  const teacher = await mk("ผู้สอน ทดสอบ", "TEACHER");
  const other = await mk("ผู้สอน อื่น", "TEACHER");
  const learners = [await mk("นายก ใจดี"), await mk("นายข ใจดี"), await mk("นายค ใจดี"), await mk("นายง ใจดี")];
  const A: CourseActor = { id: admin.id, role: "ADMIN", reviewerAreaIds: [] };
  const T: CourseActor = { id: teacher.id, role: "TEACHER", creatorStatus: "APPROVED", reviewerAreaIds: [] };
  const O: CourseActor = { id: other.id, role: "TEACHER", creatorStatus: "APPROVED", reviewerAreaIds: [] };
  const course = await db.course.create({ data: { title: "ทดสอบเกียรติบัตร", areaId: area.id, createdById: teacher.id, status: "PUBLISHED" } });
  const course2 = await db.course.create({ data: { title: "ทดสอบเกียรติบัตร 2", areaId: area.id, createdById: teacher.id, status: "PUBLISHED" } });
  const quiz = await db.quiz.create({ data: { courseId: course.id, title: "แบบทดสอบ", passPercent: 60 } });
  let serialId = "";
  try {
    // ---- number series
    assert.equal((await saveSerial(T, null, { name: "x", pattern: "{no}", padding: 4, nextNo: 1, resetYearly: true })).ok, false, "teacher cannot make a series");
    assert.equal((await saveSerial(A, null, { name: "x", pattern: "no", padding: 4, nextNo: 1, resetYearly: true })).ok, false, "pattern needs {no}");
    const s = await saveSerial(A, null, { name: "ชุดทดสอบ", pattern: "{no}/{year}", padding: 4, nextNo: 5, resetYearly: false });
    assert.ok(s.ok);
    serialId = s.ok ? s.id : "";

    // ---- designs: the author makes them, other teachers cannot touch them
    assert.equal((await createDesign(O, course.id, "ไม่ใช่ของฉัน")).ok, false);
    const d1 = await createDesign(T, course.id, "แบบทั่วไป");
    const d2 = await createDesign(T, course.id, "แบบคะแนนสูง");
    assert.ok(d1.ok && d2.ok);
    const id1 = d1.ok ? d1.id : "";
    const id2 = d2.ok ? d2.id : "";
    assert.equal((await db.certificateDesign.findUniqueOrThrow({ where: { id: id1 } })).isDefault, true, "first design is the default");
    const fields = defaultFields();
    assert.equal((await saveDesign(T, id1, { name: "แบบทั่วไป", isDefault: true, minScore: null, serialId, fields })).ok, false, "an author cannot pick the series");
    assert.equal((await saveDesign(O, id1, { name: "x", isDefault: true, minScore: null, serialId: null, fields })).ok, false);
    assert.equal((await saveDesign(A, id1, { name: "แบบทั่วไป", isDefault: true, minScore: null, serialId, fields })).ok, true);
    assert.equal((await saveDesign(A, id2, { name: "แบบคะแนนสูง", isDefault: false, minScore: 90, serialId, fields })).ok, true);
    assert.equal((await saveDesign(A, id2, { name: "x", isDefault: false, minScore: 150, serialId, fields })).ok, false, "score must be 1-100");

    // ---- finishing the course: waiting, not numbered
    const now = new Date("2026-10-20T03:00:00Z");
    for (const [i, l] of learners.entries()) {
      await db.enrollment.create({ data: { userId: l.id, courseId: course.id, progress: i === 3 ? 50 : 100, completedAt: i === 3 ? null : new Date(`2026-10-1${i + 1}T03:00:00Z`) } });
    }
    await db.quizAttempt.create({ data: { quizId: quiz.id, userId: learners[0].id, seed: 1, submittedAt: now, percent: 95, score: 95, maxScore: 100, passed: true } });
    await db.quizAttempt.create({ data: { quizId: quiz.id, userId: learners[0].id, seed: 2, submittedAt: now, percent: 70, score: 70, maxScore: 100, passed: true } });
    assert.equal(await scoreOf(learners[0].id, course.id), 95, "best attempt counts");
    assert.equal(await scoreOf(learners[1].id, course.id), null);

    assert.equal(await ensureCertificate(learners[3].id, course.id), null, "not finished -> nothing");
    const c0 = await ensureCertificate(learners[0].id, course.id, now);
    assert.equal(c0?.status, "PENDING");
    assert.equal(c0?.number, null);
    assert.equal(c0?.designId, id2, "95% gets the high-score design");
    assert.equal((await ensureCertificate(learners[1].id, course.id, now))?.designId, id1);
    assert.equal((await ensureCertificate(learners[0].id, course.id, now))?.id, c0?.id, "asking twice gives the same row");
    assert.match(c0?.verifyCode ?? "", /^[A-Z2-9]{12}$/);

    // ---- only admins give numbers; oldest finisher first; the third learner is picked up by the back-fill
    assert.equal((await issueNumbers(T, course.id, now)).ok, false);
    assert.deepEqual(await issueNumbers(A, course.id, now), { ok: true, issued: 3 });
    const rows = await db.certificate.findMany({ where: { courseId: course.id }, orderBy: { completedAt: "asc" }, include: { user: { select: { name: true } } } });
    assert.deepEqual(rows.map((x) => x.number), ["0005/2569", "0006/2569", "0007/2569"], "oldest first, from the series start");
    assert.ok(rows.every((x) => x.status === "ISSUED" && x.nameSnapshot === x.user.name && x.issuedAt));
    assert.deepEqual(await issueNumbers(A, course.id, now), { ok: true, issued: 0 }, "second press does nothing");
    assert.equal((await db.certificateSerial.findUniqueOrThrow({ where: { id: serialId } })).nextNo, 8);

    // ---- a later finisher continues the run
    await db.enrollment.update({ where: { userId_courseId: { userId: learners[3].id, courseId: course.id } }, data: { progress: 100, completedAt: now } });
    assert.equal((await ensureCertificate(learners[3].id, course.id, now))?.status, "PENDING");
    await issueNumbers(A, course.id, now);
    assert.equal((await db.certificate.findUniqueOrThrow({ where: { courseId_userId: { courseId: course.id, userId: learners[3].id } } })).number, "0008/2569");

    // ---- revoke / restore keep the number
    const one = rows[0];
    assert.equal((await revokeCertificate(T, one.id, "เหตุผลยาวพอ")).ok, false);
    assert.equal((await revokeCertificate(A, one.id, "สั้น")).ok, false);
    assert.equal((await revokeCertificate(A, one.id, "ออกให้ผิดคน")).ok, true);
    assert.equal((await revokeCertificate(A, one.id, "ออกให้ผิดคน")).ok, false, "already revoked");
    assert.equal((await restoreCertificate(A, one.id)).ok, true);
    const back = await db.certificate.findUniqueOrThrow({ where: { id: one.id } });
    assert.equal(back.status, "ISSUED");
    assert.equal(back.number, "0005/2569");

    // ---- protections
    assert.equal((await deleteDesign(T, id1)).ok, false, "cannot delete a design that was used");
    assert.equal((await deleteSerial(A, serialId)).ok, false, "cannot delete a series that is used");
    assert.equal((await saveSerial(A, serialId, { name: "ชุดทดสอบ", pattern: "{no}", padding: 4, nextNo: 9, resetYearly: false })).ok, false, "pattern frozen after numbers went out");
    assert.equal((await saveSerial(A, serialId, { name: "ชุดทดสอบ", pattern: "{no}/{year}", padding: 4, nextNo: 3, resetYearly: false })).ok, false, "counter cannot go back");
    assert.equal((await saveSerial(A, serialId, { name: "ชื่อใหม่", pattern: "{no}/{year}", padding: 4, nextNo: 20, resetYearly: false })).ok, true, "counter may jump forward");

    // ---- a design without a series issues at once
    assert.ok((await createDesign(T, course2.id, "ไม่มีเลข")).ok);
    await db.enrollment.create({ data: { userId: learners[0].id, courseId: course2.id, progress: 100, completedAt: now } });
    const c3 = await ensureCertificate(learners[0].id, course2.id, now);
    assert.equal(c3?.status, "ISSUED");
    assert.equal(c3?.number, null);
    assert.equal(await ensureCertificate(learners[1].id, "no-such-course"), null);

    // ---- fonts
    const ttf = new Uint8Array([0, 1, 0, 0, 1, 2, 3, 4]);
    assert.equal((await addFont(T, "ฟอนต์", ttf)).ok, false, "admin only");
    assert.equal((await addFont(A, "ปลอม", new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).ok, false, "a picture is not a font");
    const f = await addFont(A, "ฟอนต์ทดสอบ", ttf);
    assert.ok(f.ok);
    if (f.ok) await db.certificateFont.delete({ where: { id: f.id } });

    console.log("certificates (db): all groups passed");
  } finally {
    await db.certificate.deleteMany({ where: { courseId: { in: [course.id, course2.id] } } });
    await db.course.deleteMany({ where: { id: { in: [course.id, course2.id] } } });
    if (serialId) await db.certificateSerial.deleteMany({ where: { id: serialId } });
    await db.user.deleteMany({ where: { id: { in: [admin.id, teacher.id, other.id, ...learners.map((l) => l.id)] } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
