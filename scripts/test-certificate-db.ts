// Certificates against the real (local) database. Run: npx tsx --env-file=.env scripts/test-certificate-db.ts
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import type { CourseActor } from "../src/lib/course/access";
import { addFont, confirmCertificate, createDesign, deleteDesign, deleteSerial, ensureCertificate, issueNumbers, restoreCertificate, revokeCertificate, saveDesign, saveSerial, scoreOf } from "../src/lib/certificate/cert-store";
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
  let autoSerialId = "";
  let course3Id = "";
  const extraUsers: string[] = [];
  try {
    // ---- number series
    assert.equal((await saveSerial(T, null, { name: "x", pattern: "{no}", padding: 4, nextNo: 1, resetYearly: true, mode: "MANUAL", endNo: null })).ok, false, "teacher cannot make a series");
    assert.equal((await saveSerial(A, null, { name: "x", pattern: "no", padding: 4, nextNo: 1, resetYearly: true, mode: "MANUAL", endNo: null })).ok, false, "pattern needs {no}");
    const s = await saveSerial(A, null, { name: "ชุดทดสอบ", pattern: "{no}/{year}", padding: 4, nextNo: 5, resetYearly: false, mode: "MANUAL", endNo: null });
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
    assert.deepEqual(await issueNumbers(A, course.id, now), { ok: true, issued: 3, stopped: false });
    const rows = await db.certificate.findMany({ where: { courseId: course.id }, orderBy: { completedAt: "asc" }, include: { user: { select: { name: true } } } });
    assert.deepEqual(rows.map((x) => x.number), ["0005/2569", "0006/2569", "0007/2569"], "oldest first, from the series start");
    assert.ok(rows.every((x) => x.status === "ISSUED" && x.nameSnapshot === x.user.name && x.issuedAt));
    assert.deepEqual(await issueNumbers(A, course.id, now), { ok: true, issued: 0, stopped: false }, "second press does nothing");
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
    assert.equal((await saveSerial(A, serialId, { name: "ชุดทดสอบ", pattern: "{no}", padding: 4, nextNo: 9, resetYearly: false, mode: "MANUAL", endNo: null })).ok, false, "pattern frozen after numbers went out");
    assert.equal((await saveSerial(A, serialId, { name: "ชุดทดสอบ", pattern: "{no}/{year}", padding: 4, nextNo: 3, resetYearly: false, mode: "MANUAL", endNo: null })).ok, false, "counter cannot go back");
    assert.equal((await saveSerial(A, serialId, { name: "ชื่อใหม่", pattern: "{no}/{year}", padding: 4, nextNo: 20, resetYearly: false, mode: "MANUAL", endNo: null })).ok, true, "counter may jump forward");

    // ---- a design without a series issues at once
    assert.ok((await createDesign(T, course2.id, "ไม่มีเลข")).ok);
    await db.enrollment.create({ data: { userId: learners[0].id, courseId: course2.id, progress: 100, completedAt: now } });
    const c3 = await ensureCertificate(learners[0].id, course2.id, now);
    assert.equal(c3?.status, "ISSUED");
    assert.equal(c3?.number, null);
    assert.equal(await ensureCertificate(learners[1].id, "no-such-course"), null);

    // ---- automatic series: the LEARNER confirms and gets the next number at once
    const autoS = await saveSerial(A, null, { name: "นักเรียน", pattern: "น.{no}/{year}", padding: 3, nextNo: 1, resetYearly: false, mode: "AUTO", endNo: 5 });
    assert.ok(autoS.ok);
    autoSerialId = autoS.ok ? autoS.id : "";
    assert.equal((await saveSerial(A, null, { name: "ผิด", pattern: "{no}", padding: 3, nextNo: 10, resetYearly: false, mode: "AUTO", endNo: 5 })).ok, false, "end below start is refused");
    assert.equal((await saveSerial(A, null, { name: "ผิด", pattern: "{no}", padding: 3, nextNo: 1, resetYearly: false, mode: "BOGUS" as never, endNo: null })).ok, false, "unknown mode is refused");
    const course3 = await db.course.create({ data: { title: "คอร์สนักเรียน", areaId: area.id, createdById: teacher.id, status: "PUBLISHED" } });
    course3Id = course3.id;
    const d4 = await createDesign(T, course3.id, "แบบนักเรียน");
    assert.ok(d4.ok);
    assert.ok((await saveDesign(A, d4.ok ? d4.id : "", { name: "แบบนักเรียน", isDefault: true, minScore: null, serialId: autoSerialId, fields })).ok);
    const students: { id: string }[] = [];
    for (let i = 1; i <= 8; i++) { const u = await mk(`นักเรียน ${i}`); students.push(u); extraUsers.push(u.id); }
    for (const st of students) await db.enrollment.create({ data: { userId: st.id, courseId: course3.id, progress: 100, completedAt: now } });
    for (const st of students) assert.equal((await ensureCertificate(st.id, course3.id, now))?.status, "PENDING", "waits for the learner to confirm");

    // a MANUAL series cannot be self-confirmed; strangers and unfinished learners have nothing to confirm
    const manualStudent = await mk("นักเรียน ข้อมือ");
    extraUsers.push(manualStudent.id);
    await db.enrollment.create({ data: { userId: manualStudent.id, courseId: course.id, progress: 100, completedAt: now } });
    assert.equal((await ensureCertificate(manualStudent.id, course.id, now))?.status, "PENDING");
    const denied = await confirmCertificate(manualStudent.id, course.id, now);
    assert.equal(denied.ok, false, "MANUAL: only the admin gives the number");
    assert.equal((await confirmCertificate(teacher.id, course3.id, now)).ok, false, "no certificate row for someone who did not finish");

    // 5 learners press at the same moment: 5 different, consecutive numbers (the range is 1-5)
    const results = await Promise.all(students.slice(0, 5).map((st) => confirmCertificate(st.id, course3.id, now)));
    assert.ok(results.every((r) => r.ok));
    const nums = results.map((r) => (r.ok ? r.number : "")).sort();
    assert.deepEqual(nums, ["น.001/2569", "น.002/2569", "น.003/2569", "น.004/2569", "น.005/2569"]);
    assert.equal((await db.certificateSerial.findUniqueOrThrow({ where: { id: autoSerialId } })).nextNo, 6);
    const issued0 = await db.certificate.findUniqueOrThrow({ where: { courseId_userId: { courseId: course3.id, userId: students[0].id } } });
    assert.equal(issued0.status, "ISSUED");
    assert.equal(issued0.nameSnapshot, "นักเรียน 1");
    assert.equal(issued0.issuedById, students[0].id);

    // pressing again does not use a second number
    const again = await confirmCertificate(students[0].id, course3.id, now);
    assert.ok(again.ok && again.number === issued0.number);
    assert.equal((await db.certificateSerial.findUniqueOrThrow({ where: { id: autoSerialId } })).nextNo, 6, "no number used up by a second press");

    // the range is used up: refused, still waiting, counter not moved
    const out = await confirmCertificate(students[5].id, course3.id, now);
    assert.equal(out.ok, false);
    assert.ok(!out.ok && out.error.includes("หมดแล้ว"));
    assert.equal((await db.certificate.findUniqueOrThrow({ where: { courseId_userId: { courseId: course3.id, userId: students[5].id } } })).status, "PENDING");
    assert.equal((await db.certificateSerial.findUniqueOrThrow({ where: { id: autoSerialId } })).nextNo, 6);

    // range can only be extended, never cut below the numbers already given
    assert.equal((await saveSerial(A, autoSerialId, { name: "นักเรียน", pattern: "น.{no}/{year}", padding: 3, nextNo: 6, resetYearly: false, mode: "AUTO", endNo: 3 })).ok, false);
    assert.equal((await saveSerial(A, autoSerialId, { name: "นักเรียน", pattern: "น.{no}/{year}", padding: 3, nextNo: 6, resetYearly: false, mode: "AUTO", endNo: 6 })).ok, true);
    const six = await confirmCertificate(students[5].id, course3.id, now);
    assert.ok(six.ok && six.number === "น.006/2569", "after the range was extended the next learner continues the run");

    // the admin may also number the ones who have not pressed; it stops at the end of the range
    assert.equal((await saveSerial(A, autoSerialId, { name: "นักเรียน", pattern: "น.{no}/{year}", padding: 3, nextNo: 7, resetYearly: false, mode: "AUTO", endNo: 7 })).ok, true);
    assert.deepEqual(await issueNumbers(A, course3.id, now), { ok: true, issued: 1, stopped: true }, "one number left, one learner still waiting");
    assert.equal((await db.certificate.count({ where: { courseId: course3.id, status: "PENDING" } })), 1);
    assert.equal((await db.certificateSerial.findUniqueOrThrow({ where: { id: autoSerialId } })).nextNo, 8);
    assert.equal((await saveSerial(A, autoSerialId, { name: "นักเรียน", pattern: "น.{no}/{year}", padding: 3, nextNo: 8, resetYearly: false, mode: "MANUAL", endNo: null })).ok, true, "the mode can be switched; numbers go on");
    assert.equal((await confirmCertificate(students[7].id, course3.id, now)).ok, false, "after switching to MANUAL the learner can no longer take a number");

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
    if (course3Id) { await db.certificate.deleteMany({ where: { courseId: course3Id } }); await db.course.deleteMany({ where: { id: course3Id } }); }
    await db.certificate.deleteMany({ where: { userId: { in: extraUsers } } });
    if (serialId) await db.certificateSerial.deleteMany({ where: { id: serialId } });
    if (autoSerialId) await db.certificateSerial.deleteMany({ where: { id: autoSerialId } });
    await db.user.deleteMany({ where: { id: { in: [admin.id, teacher.id, other.id, ...learners.map((l) => l.id), ...extraUsers] } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
