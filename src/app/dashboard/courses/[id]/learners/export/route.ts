import { canEditCourse } from "@/lib/course/access";
import { allLearners, asLearnerStatus } from "@/lib/course/course-learners";
import { getCourseActor } from "@/lib/course/course-server";
import { db } from "@/lib/db";
import { buildSpreadsheet } from "@/lib/excel";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";

/** Learner list of one course as a spreadsheet. Only people who may edit the course (the owner or an admin). No e-mail / phone on purpose. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const actor = await getCourseActor();
  if (!actor) return new Response("Forbidden", { status: 403 });
  const course = await db.course.findUnique({ where: { id: params.id }, select: { id: true, title: true, createdById: true, status: true, dueAt: true } });
  if (!course || !canEditCourse(actor, course)) return new Response("Forbidden", { status: 403 });

  const sp = new URL(req.url).searchParams;
  const rows = await allLearners(course.id, { q: sp.get("q") ?? "", status: asLearnerStatus(sp.get("status") ?? undefined) });
  const file = await buildSpreadsheet(
    "ผู้เรียน",
    ["ลำดับ", "ชื่อ-สกุล", "ประเภทสมาชิก", "โรงเรียน", "อำเภอ", "หน่วยงาน", "ตำแหน่ง", "ความคืบหน้า (%)", "สถานะ", "ลงทะเบียนเมื่อ", "เรียนจบเมื่อ", "เข้าเรียนล่าสุด", "เทียบกับกำหนดส่ง"],
    rows.map((r, i) => [
      i + 1, r.user.name, MEMBER_TYPE_LABEL[r.user.memberType], r.user.memberSchool?.name ?? null, r.user.memberSchool?.district ?? null, r.user.organization, r.user.position,
      r.progress, r.completedAt ? "เรียนจบแล้ว" : r.progress > 0 ? "กำลังเรียน" : "ยังไม่เริ่ม",
      formatThaiDate(r.createdAt), r.completedAt ? formatThaiDate(r.completedAt) : null, formatThaiDate(r.updatedAt),
      course.dueAt ? (r.completedAt ? (r.completedAt > course.dueAt ? "จบหลังกำหนด" : "จบทันกำหนด") : new Date() > course.dueAt ? "เกินกำหนด" : "ยังอยู่ในกำหนด") : null,
    ]),
    [7, 30, 14, 32, 14, 24, 20, 14, 12, 16, 16, 16, 18],
  );
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="course-learners.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
