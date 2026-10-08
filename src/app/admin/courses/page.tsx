import { db } from "@/lib/db";
import { requireManagerPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  await requireManagerPage();
  const courses = await db.course.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { lessons: true, enrollments: true } } },
  });
  const avg = new Map((await db.enrollment.groupBy({ by: ["courseId"], _avg: { progress: true } })).map((a) => [a.courseId, Math.round(a._avg.progress ?? 0)]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">คอร์สเรียน</h1>
        <p className="text-sm text-neutral-500">ทั้งหมด {courses.length} คอร์ส (หน้านี้เป็นรายการอ่านอย่างเดียว ฟอร์มสร้าง/แก้ไขจะทำเป็นขั้นต่อไป)</p>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white p-2 shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-neutral-500">
            <tr><th className="p-3 font-medium">ชื่อคอร์ส</th><th className="p-3 font-medium">บทเรียน</th><th className="p-3 font-medium">ผู้เรียน</th><th className="p-3 font-medium">ความคืบหน้าเฉลี่ย</th><th className="p-3 font-medium">สถานะ</th></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="p-3 font-medium">{c.title}</td>
                <td className="p-3">{c._count.lessons}</td>
                <td className="p-3">{c._count.enrollments}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 rounded-full bg-neutral-100"><div className="h-2 rounded-full bg-brand" style={{ width: `${avg.get(c.id) ?? 0}%` }} /></div>
                    <span className="text-xs text-neutral-500">{avg.get(c.id) ?? 0}%</span>
                  </div>
                </td>
                <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${c.published ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>{c.published ? "เปิดแล้ว" : "ฉบับร่าง"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
