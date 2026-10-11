import Link from "next/link";
import { redirect } from "next/navigation";
import Glyph from "@/components/glyph";
import Lines from "@/components/lines";
import { loadCourseState } from "@/lib/course/course-learn";
import { coverOf } from "@/lib/course/course-server";
import { nextLesson } from "@/lib/course/rules";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteTexts } from "@/lib/site-texts-server";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
export const metadata = { title: "คอร์สที่ฉันเรียน" };

export default async function LearningPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/dashboard/learning");
  const texts = await getSiteTexts();

  const rows = await db.enrollment.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { courseId: true, progress: true, completedAt: true, lastLessonId: true, course: { select: { title: true, status: true, coverKey: true, coverDriveId: true, coverFx: true, coverFy: true, area: { select: { name: true, color: true, icon: true } } } } },
  });
  const items = await Promise.all(rows.map(async (r) => {
    const live = r.course.status === "PUBLISHED";
    const state = live ? await loadCourseState(session.user.id, r.courseId) : null;
    const lessonId = state ? (state.lessons.some((l) => l.id === r.lastLessonId) && !r.completedAt ? r.lastLessonId : nextLesson(state.lessons, state.done)?.id ?? state.lessons[0]?.id) ?? null : null;
    return { ...r, live, lessonId };
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <Link href="/dashboard" className="text-sm text-brand">← บัญชีของฉัน</Link>
        <h1 className="text-2xl font-bold"><Lines text={texts["learning.title"]} /></h1>
        <p className="text-sm text-neutral-500"><Lines text={texts["learning.subtitle"]} /></p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="font-semibold">ยังไม่ได้ลงทะเบียนเรียนคอร์สใด</p>
          <Link href="/courses" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white">ดูคอร์สทั้งหมด</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => {
            const cover = coverOf(c.course);
            return (
              <li key={c.courseId} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg sm:w-36" style={{ backgroundColor: c.course.area.color }}>
                  {cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={{ objectPosition: `${c.course.coverFx * 100}% ${c.course.coverFy * 100}%` }} />
                    : <span className="flex h-full items-center justify-center text-white"><Glyph name={c.course.area.icon} size={30} strokeWidth={1.4} /></span>}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="line-clamp-2 font-semibold leading-snug">{c.course.title}</p>
                  <p className="text-xs text-neutral-500">{c.course.area.name}</p>
                  {c.live ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200" role="progressbar" aria-valuenow={c.progress} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้า"><div className={`h-full rounded-full ${c.completedAt ? "bg-green-600" : "bg-brand"}`} style={{ width: `${c.progress}%` }} /></div>
                        <span className="w-10 text-right text-xs font-medium text-neutral-600">{c.progress}%</span>
                      </div>
                      {c.completedAt && <p className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><Glyph name="trophy" size={14} />เรียนจบเมื่อ {formatThaiDate(c.completedAt)}</p>}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {c.lessonId && <Link href={`/courses/${c.courseId}/learn/${c.lessonId}`} className="flex min-h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">{c.completedAt ? "ทบทวน" : c.progress > 0 ? "เรียนต่อ" : "เริ่มเรียน"}</Link>}
                        <Link href={`/courses/${c.courseId}`} className="flex min-h-10 items-center rounded-lg border border-neutral-300 px-3 text-sm">หน้าคอร์ส</Link>
                      </div>
                    </>
                  ) : <p className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">คอร์สนี้กำลังปรับปรุงหรือปิดชั่วคราว — ความคืบหน้าของคุณยังอยู่</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
