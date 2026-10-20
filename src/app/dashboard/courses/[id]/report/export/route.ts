import { canEditCourse } from "@/lib/course/access";
import { getCourseReport } from "@/lib/course/course-report";
import { getCourseActor } from "@/lib/course/course-server";
import { buildSpreadsheet } from "@/lib/excel";

export const dynamic = "force-dynamic";

/** The school report as a spreadsheet. Counts only, for the course owner and admins. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await getCourseActor();
  if (!actor) return new Response("Forbidden", { status: 403 });
  const r = await getCourseReport(params.id);
  if (!r || !canEditCourse(actor, { createdById: r.course.createdById })) return new Response("Forbidden", { status: 403 });
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const rows = [...r.schools.filter((s) => s.population > 0), ...(r.other ? [r.other] : [])];
  const file = await buildSpreadsheet(
    "รายงานรายโรงเรียน",
    ["อำเภอ", "ศูนย์เครือข่าย", "รหัสโรงเรียน", "โรงเรียน", "สมาชิกในกลุ่ม", "ลงเรียน", "เรียนจบ", "จบหลังกำหนด", "% ลงเรียน", "% เรียนจบ"],
    rows.map((s) => [s.district || null, s.center || null, s.code, s.name, s.population, s.joined, s.completed, r.course.dueAt ? s.late : null, pct(s.joined, s.population), pct(s.completed, s.population)]),
    [14, 22, 14, 34, 14, 10, 10, 14, 11, 11],
  );
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="course-school-report.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
