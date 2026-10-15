// Smoke test of the Excel quiz import pages against a RUNNING local server (npm run dev / next start on :3000).
// Signs test members in with a session cookie made from the local .env (the secret is never printed).
// Run: npx tsx --env-file=.env scripts/smoke-quiz-import.ts
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { encode } from "next-auth/jwt";
import { db } from "../src/lib/db";
import { readSpreadsheet } from "../src/lib/excel";
import { parseQuizSheet } from "../src/lib/course/quiz/import";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const stamp = Date.now();

async function cookieFor(u: { id: string; role: "ADMIN" | "TEACHER" | "STUDENT"; name: string; email: string }) {
  const token = await encode({ token: { sub: u.id, id: u.id, role: u.role, name: u.name, email: u.email }, secret: process.env.NEXTAUTH_SECRET!, maxAge: 3600 });
  return `next-auth.session-token=${token}`;
}
const get = (path: string, cookie?: string) => fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });

async function main() {
  const area = await db.learningArea.findFirstOrThrow();
  const teacher = await db.user.create({ data: { name: "ผู้สอน smoke", email: `qs-1-${stamp}@test.local`, passwordHash: "x", role: "TEACHER" } });
  const stranger = await db.user.create({ data: { name: "คนอื่น smoke", email: `qs-2-${stamp}@test.local`, passwordHash: "x", role: "TEACHER" } });
  const course = await db.course.create({ data: { title: "คอร์ส smoke นำเข้า", areaId: area.id, createdById: teacher.id } });
  const quiz = await db.quiz.create({ data: { courseId: course.id, title: "ชุด smoke" } });
  try {
    const cT = await cookieFor({ id: teacher.id, role: "TEACHER", name: teacher.name, email: teacher.email! });
    const cS = await cookieFor({ id: stranger.id, role: "TEACHER", name: stranger.name, email: stranger.email! });

    // the template: signed-in only, a real workbook with both tabs, and the question tab reads back as examples only
    assert.equal((await get("/dashboard/courses/quiz-import-template")).status, 307, "signed-out goes to login");
    const res = await get("/dashboard/courses/quiz-import-template", cT);
    assert.equal(res.status, 200);
    assert.ok((res.headers.get("content-type") ?? "").includes("spreadsheetml"));
    assert.ok((res.headers.get("content-disposition") ?? "").includes("quiz-import-template.xlsx"));
    const bytes = Buffer.from(await res.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
    assert.deepEqual(wb.worksheets.map((w) => w.name), ["วิธีใช้", "แบบทดสอบ"]);
    const parsed = parseQuizSheet((await readSpreadsheet(bytes, "t.xlsx", "แบบทดสอบ")).rows);
    assert.ok(!parsed.ok && parsed.error.includes("แถวตัวอย่าง"));

    // the quiz page offers the import to the author, and not to somebody else's course
    const page = await (await get(`/dashboard/courses/${course.id}/quizzes/${quiz.id}`, cT)).text();
    assert.ok(page.includes("นำเข้าข้อสอบปรนัยจาก Excel"), "the import card is on the quiz page");
    assert.equal((await get(`/dashboard/courses/${course.id}/quizzes/${quiz.id}`, cS)).status, 404);

    console.log("quiz import pages smoke: all checks passed");
  } finally {
    await db.course.deleteMany({ where: { id: course.id } });
    await db.user.deleteMany({ where: { id: { in: [teacher.id, stranger.id] } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
