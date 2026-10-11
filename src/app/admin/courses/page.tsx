import Link from "next/link";
import LiveFilter from "@/components/live-filter";
import { COURSE_STATUS_LABEL } from "@/lib/course/course-server";
import { db } from "@/lib/db";
import { requireManagerPage } from "@/lib/permissions";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
export const metadata = { title: "คอร์สเรียน" };

const STATUSES = ["PENDING", "PUBLISHED", "DRAFT", "REJECTED"] as const;
const select = "min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm";

export default async function AdminCoursesPage({ searchParams }: { searchParams: { q?: string; status?: string; area?: string } }) {
  await requireManagerPage();
  const status = (STATUSES as readonly string[]).includes(searchParams.status ?? "") ? (searchParams.status as (typeof STATUSES)[number]) : undefined;
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const [courses, counts, areas] = await Promise.all([
    db.course.findMany({
      where: { ...(status && { status }), ...(searchParams.area && { areaId: searchParams.area }), ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { createdBy: { name: { contains: q, mode: "insensitive" } } }] }) },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
      include: { area: { select: { name: true } }, createdBy: { select: { name: true } }, _count: { select: { lessons: true, enrollments: true } } },
    }),
    db.course.groupBy({ by: ["status"], _count: { _all: true } }),
    db.learningArea.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">คอร์สเรียน</h1>
        <p className="text-sm text-neutral-500">ทุกคอร์สในระบบ · รอตรวจ {count("PENDING")} · เผยแพร่แล้ว {count("PUBLISHED")} · ร่าง {count("DRAFT")} · ส่งกลับ {count("REJECTED")}</p>
      </div>

      <LiveFilter
        action="/admin/courses"
        className="space-y-4"
        formClassName="grid gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-3"
        fields={
          <>
            <input name="q" type="search" defaultValue={q} placeholder="ค้นหาชื่อคอร์สหรือชื่อผู้สร้าง" aria-label="ค้นหาคอร์ส" className={select} />
            <select name="status" defaultValue={status ?? ""} aria-label="สถานะ" className={select}>
              <option value="">ทุกสถานะ</option>
              {STATUSES.map((s) => <option key={s} value={s}>{COURSE_STATUS_LABEL[s][0]}</option>)}
            </select>
            <select name="area" defaultValue={searchParams.area ?? ""} aria-label="กลุ่มสาระ" className={select}>
              <option value="">ทุกกลุ่มสาระ</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </>
        }
      >
        <div className="overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-neutral-500"><tr>{["ชื่อคอร์ส", "กลุ่มสาระ", "ผู้สร้าง", "บท", "ผู้เรียน", "สถานะ", "แก้ไขล่าสุด"].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {courses.map((c) => {
                const [label, tone] = COURSE_STATUS_LABEL[c.status];
                return (
                  <tr key={c.id} className="border-t border-neutral-100 align-top">
                    <td className="p-3 font-medium"><Link href={`/admin/courses/${c.id}`} className="text-brand hover:underline">{c.title}</Link></td>
                    <td className="p-3 text-neutral-600">{c.area.name}</td>
                    <td className="p-3 text-neutral-600">{c.createdBy.name}</td>
                    <td className="p-3 tabular-nums">{c._count.lessons}</td>
                    <td className="p-3 tabular-nums">{c._count.enrollments}</td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{label}</span></td>
                    <td className="p-3 text-neutral-600">{formatThaiDate(c.updatedAt)}</td>
                  </tr>
                );
              })}
              {courses.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-neutral-500">ไม่พบคอร์ส</td></tr>}
            </tbody>
          </table>
        </div>
      </LiveFilter>
    </div>
  );
}
