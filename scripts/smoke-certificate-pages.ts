// Smoke test of the certificate pages against a RUNNING local server (npm run dev / next start on :3000).
// It signs test members in with a session cookie it makes itself from the local .env (the secret is never printed).
// Run: npx tsx --env-file=.env scripts/smoke-certificate-pages.ts
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { db } from "../src/lib/db";
import { confirmCertificate, createDesign, ensureCertificate, issueNumbers, saveDesign, saveSerial } from "../src/lib/certificate/cert-store";
import { defaultFields } from "../src/lib/certificate/schema";

// the menu's props carry every editable text, so look for the real element, not just the words
const CONFIRM_BUTTON = />ตรวจชื่อแล้ว รับเกียรติบัตร<\/(button|a)>/;
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const stamp = Date.now();

async function cookieFor(u: { id: string; role: "ADMIN" | "TEACHER" | "STUDENT"; name: string; email: string }) {
  const token = await encode({ token: { sub: u.id, id: u.id, role: u.role, name: u.name, email: u.email }, secret: process.env.NEXTAUTH_SECRET!, maxAge: 3600 });
  return `next-auth.session-token=${token}`;
}
async function get(path: string, cookie?: string) {
  const r = await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { status: r.status, text: await r.text(), location: r.headers.get("location") };
}

async function main() {
  const area = await db.learningArea.findFirstOrThrow();
  let n = 0;
  const mk = (name: string, role: "ADMIN" | "TEACHER" | "STUDENT") => db.user.create({ data: { name, email: `smoke-${n++}-${stamp}@test.local`, passwordHash: "x", role } });
  const admin = await mk("แอดมิน ทดสอบ", "ADMIN");
  const teacher = await mk("ผู้สอน ทดสอบ", "TEACHER");
  const learner = await mk("นายวินัย หนุนกระโทก", "STUDENT");
  const stranger = await mk("คนนอก ทดสอบ", "STUDENT");
  const course = await db.course.create({ data: { title: "คอร์สทดสอบเกียรติบัตร", areaId: area.id, createdById: teacher.id, status: "PUBLISHED", enrollOpen: true } });
  let serialId = "";
  let autoSerialId = "";
  let course2Id = "";
  try {
    const A = { id: admin.id, role: "ADMIN", reviewerAreaIds: [] as string[] };
    const T = { id: teacher.id, role: "TEACHER", creatorStatus: "APPROVED", reviewerAreaIds: [] as string[] };
    const s = await saveSerial(A, null, { name: "ชุดทดสอบ smoke", pattern: "{no}/{year}", padding: 4, nextNo: 1, resetYearly: true, mode: "MANUAL", endNo: null });
    assert.ok(s.ok);
    serialId = s.ok ? s.id : "";
    const d = await createDesign(T, course.id, "แบบทดสอบ");
    assert.ok(d.ok);
    const designId = d.ok ? d.id : "";
    assert.ok((await saveDesign(A, designId, { name: "แบบทดสอบ", isDefault: true, minScore: null, serialId, fields: defaultFields() })).ok);
    await db.enrollment.create({ data: { userId: learner.id, courseId: course.id, progress: 100, completedAt: new Date() } });
    const row = await ensureCertificate(learner.id, course.id);
    assert.ok(row);

    const cA = await cookieFor({ id: admin.id, role: "ADMIN", name: admin.name, email: admin.email! });
    const cT = await cookieFor({ id: teacher.id, role: "TEACHER", name: teacher.name, email: teacher.email! });
    const cL = await cookieFor({ id: learner.id, role: "STUDENT", name: learner.name, email: learner.email! });
    const cS = await cookieFor({ id: stranger.id, role: "STUDENT", name: stranger.name, email: stranger.email! });

    // ---- while waiting for a number
    let r = await get(`/courses/${course.id}`, cL);
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("รอออกเลขที่เกียรติบัตร"), "course page shows the waiting label");
    assert.ok(!r.text.includes(`/certificates/${row!.id}`), "no download link while waiting");
    assert.ok(r.text.includes("นายวินัย หนุนกระโทก"), "the certificate (preview) shows the holder");

    r = await get("/dashboard/certificates", cL);
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("เกียรติบัตรของฉัน") && r.text.includes("รอออกเลขที่เกียรติบัตร"));

    r = await get(`/certificates/${row!.id}`, cL);
    assert.equal(r.status, 200);
    assert.ok(!r.text.includes("พิมพ์ / บันทึกเป็น PDF"), "no print button before the number is issued");
    assert.equal((await get(`/certificates/${row!.id}`, cS)).status, 404, "a stranger cannot open it");
    assert.equal((await get(`/certificates/${row!.id}`)).status, 307, "signed-out is sent to login");
    assert.equal((await get(`/certificates/${row!.id}`, cT)).status, 200, "the course author may open it");

    r = await get(`/verify/${row!.verifyCode}`);
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("ไม่พบเกียรติบัตรตามรหัสนี้"), "a waiting certificate does not verify");

    // ---- manage tab
    r = await get(`/dashboard/courses/${course.id}/edit?tab=certificate`, cT);
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("แบบทดสอบ") && r.text.includes("รอออกเลข"));
    assert.ok(!r.text.includes("ออกเลขให้ผู้ที่รอทั้งหมด"), "only admins see the issue button");
    r = await get(`/dashboard/courses/${course.id}/edit?tab=certificate`, cA);
    assert.ok(r.text.includes("ออกเลขให้ผู้ที่รอทั้งหมด"));
    r = await get(`/dashboard/courses/${course.id}/edit?tab=certificate&design=${designId}`, cT);
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("ภาพเทมเพลต") && r.text.includes("ตำแหน่งข้อมูล"));
    assert.equal((await get(`/dashboard/courses/${course.id}/edit?tab=certificate`, cS)).status, 404, "a stranger cannot manage");

    // ---- admin page
    r = await get("/admin/certificates", cA);
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("ชุดเลขเกียรติบัตร") && r.text.includes("ฟอนต์สำหรับเกียรติบัตร"));
    assert.notEqual((await get("/admin/certificates", cT)).status, 200, "a teacher is turned away");

    // ---- after the admin issues numbers
    assert.deepEqual(await issueNumbers(A, course.id), { ok: true, issued: 1, stopped: false });
    r = await get(`/courses/${course.id}`, cL);
    assert.ok(r.text.includes(`/certificates/${row!.id}`), "download link appears once numbered");
    assert.ok(r.text.includes("เปิดเพื่อพิมพ์"));
    r = await get(`/certificates/${row!.id}`, cL);
    assert.equal(r.status, 200);
    assert.ok(r.text.includes("พิมพ์ / บันทึกเป็น PDF"), "print button after issue");
    assert.ok(/เลขที่ \d{4}\/\d{4}/.test(r.text), "the number is printed");
    r = await get(`/verify/${row!.verifyCode}`);
    assert.ok(r.text.includes("เกียรติบัตรนี้ถูกต้อง") && r.text.includes("นายวินัย หนุนกระโทก"));
    r = await get(`/verify/${row!.verifyCode.toLowerCase()}`);
    assert.ok(r.text.includes("เกียรติบัตรนี้ถูกต้อง"), "codes are case-insensitive");
    assert.ok((await get("/verify/ZZZZZZZZZZZZ")).text.includes("ไม่พบเกียรติบัตร"));
    assert.equal((await get("/verify")).status, 200);

    // ---- an automatic series: the learner sees the name check + button, then the number and the print button
    const as = await saveSerial(A, null, { name: "ชุดอัตโนมัติ smoke", pattern: "น.{no}/{year}", padding: 3, nextNo: 1, resetYearly: false, mode: "AUTO", endNo: null });
    assert.ok(as.ok);
    autoSerialId = as.ok ? as.id : "";
    const course2 = await db.course.create({ data: { title: "คอร์สนักเรียน smoke", areaId: area.id, createdById: teacher.id, status: "PUBLISHED", enrollOpen: true } });
    course2Id = course2.id;
    const d2 = await createDesign(T, course2.id, "แบบนักเรียน");
    assert.ok(d2.ok);
    assert.ok((await saveDesign(A, d2.ok ? d2.id : "", { name: "แบบนักเรียน", isDefault: true, minScore: null, serialId: autoSerialId, fields: defaultFields() })).ok);
    await db.enrollment.create({ data: { userId: stranger.id, courseId: course2.id, progress: 100, completedAt: new Date() } });
    const rowA = await ensureCertificate(stranger.id, course2.id);
    assert.ok(rowA);

    r = await get(`/courses/${course2.id}`, cS);
    assert.equal(r.status, 200);
    assert.ok(CONFIRM_BUTTON.test(r.text), "the learner can take the number");
    assert.ok(r.text.includes("คนนอก ทดสอบ"), "the name to check is shown");
    assert.ok(!r.text.includes("พิมพ์ / ดาวน์โหลด (ยังไม่เปิดให้ใช้)"), "no greyed-out print button for an automatic series");
    r = await get(`/certificates/${rowA!.id}`, cS);
    assert.ok(CONFIRM_BUTTON.test(r.text) && !r.text.includes("พิมพ์ / บันทึกเป็น PDF"));
    r = await get(`/certificates/${rowA!.id}`, cT);
    assert.ok(!CONFIRM_BUTTON.test(r.text), "the course author does not get the learner's button");
    r = await get("/dashboard/certificates", cS);
    assert.ok(CONFIRM_BUTTON.test(r.text));
    r = await get("/admin/certificates", cA);
    assert.ok(r.text.includes("ต่อเนื่องอัตโนมัติ") && r.text.includes("เลขลำดับสิ้นสุด"));

    const got = await confirmCertificate(stranger.id, course2.id);
    assert.ok(got.ok && got.number === "น.001/2569".replace("2569", String(new Date().getFullYear() + 543)));
    r = await get(`/certificates/${rowA!.id}`, cS);
    assert.ok(r.text.includes("พิมพ์ / บันทึกเป็น PDF") && r.text.includes("น.001/"), "after taking the number the print button appears");
    r = await get(`/verify/${rowA!.verifyCode}`);
    assert.ok(r.text.includes("เกียรติบัตรนี้ถูกต้อง") && r.text.includes("น.001/"));

    console.log("certificate pages smoke: all checks passed");
  } finally {
    await db.certificate.deleteMany({ where: { courseId: { in: [course.id, course2Id].filter(Boolean) } } });
    if (course2Id) await db.course.deleteMany({ where: { id: course2Id } });
    if (autoSerialId) await db.certificateSerial.deleteMany({ where: { id: autoSerialId } });
    await db.course.delete({ where: { id: course.id } });
    if (serialId) await db.certificateSerial.deleteMany({ where: { id: serialId } });
    await db.user.deleteMany({ where: { id: { in: [admin.id, teacher.id, learner.id, stranger.id] } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
