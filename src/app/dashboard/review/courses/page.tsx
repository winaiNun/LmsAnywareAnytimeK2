import Link from "next/link";
import { redirect } from "next/navigation";
import Glyph from "@/components/glyph";
import { COURSE_STATUS_LABEL, getCourseActor } from "@/lib/course/course-server";
import { db } from "@/lib/db";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตรวจคอร์ส" };

export default async function ReviewCoursesPage() {
  const actor = await getCourseActor();
  if (!actor) redirect("/login?callbackUrl=/dashboard/review/courses");
  const admin = actor.role === "ADMIN";
  if (!admin && actor.reviewerAreaIds.length === 0) redirect("/dashboard");

  const [queue, mediaCount, areas] = await Promise.all([
    db.course.findMany({
      where: { status: "PENDING", ...(admin ? {} : { areaId: { in: actor.reviewerAreaIds } }) },
      orderBy: { updatedAt: "asc" },
      select: { id: true, title: true, updatedAt: true, createdById: true, area: { select: { name: true, icon: true } }, createdBy: { select: { name: true } }, _count: { select: { lessons: true } } },
    }),
    db.media.count({ where: { status: "PENDING", ...(admin ? {} : { areaId: { in: actor.reviewerAreaIds } }) } }),
    db.learningArea.findMany({ where: { id: { in: actor.reviewerAreaIds } }, select: { name: true } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <Link href="/dashboard" className="text-sm text-brand">← บัญชีของฉัน</Link>
        <h1 className="text-2xl font-bold">ตรวจคอร์ส</h1>
        <p className="text-sm text-neutral-500">{admin ? "ทุกกลุ่มสาระ" : `คุณดูแลกลุ่มสาระ: ${areas.map((a) => a.name).join(", ")}`} · รอตรวจ {queue.length} คอร์ส</p>
      </div>
      <nav aria-label="ประเภทที่ตรวจ" className="flex gap-2">
        <Link href="/dashboard/review" className="flex min-h-11 items-center rounded-full border border-neutral-300 bg-white px-5 text-sm">สื่อ{mediaCount > 0 ? ` (${mediaCount})` : ""}</Link>
        <Link href="/dashboard/review/courses" aria-current="page" className="flex min-h-11 items-center rounded-full border border-brand bg-brand-soft px-5 text-sm font-semibold text-brand">คอร์ส{queue.length > 0 ? ` (${queue.length})` : ""}</Link>
      </nav>
      {queue.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">ไม่มีคอร์สรออนุมัติ</p>
      ) : (
        <ul className="space-y-3">
          {queue.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/review/courses/${c.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-brand">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 truncate font-semibold"><Glyph name={c.area.icon} size={16} className="shrink-0 text-neutral-500" />{c.title}</span>
                  <span className="block text-xs text-neutral-500">{c.area.name} · {c._count.lessons} บท · {c.createdBy.name} · ส่งเมื่อ {formatThaiDate(c.updatedAt)}{c.createdById === actor.id ? " · ของคุณเอง (ต้องให้คนอื่นอนุมัติ)" : ""}</span>
                </span>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${COURSE_STATUS_LABEL.PENDING[1]}`}>ตรวจ →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
