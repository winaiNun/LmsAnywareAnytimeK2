import Link from "next/link";
import { redirect } from "next/navigation";
import Glyph from "@/components/glyph";
import { canCreateCourse } from "@/lib/course/access";
import { COURSE_STATUS_LABEL, coverOf, getCourseActor } from "@/lib/course/course-server";
import { db } from "@/lib/db";
import { formatThaiDate } from "@/lib/thai-date";
import { getSiteTexts } from "@/lib/site-texts-server";
import Lines from "@/components/lines";

export const dynamic = "force-dynamic";
export const metadata = { title: "คอร์สของฉัน (ผู้สอน)" };

const SAVED: Record<string, string> = { PENDING: "ส่งขออนุมัติแล้ว — คอร์สจะแสดงบนเว็บหลังผู้ตรวจอนุมัติ", PUBLISHED: "เผยแพร่แล้ว", DELETED: "ลบคอร์สแล้ว" };

export default async function MyCoursesPage({ searchParams }: { searchParams: { saved?: string } }) {
  const actor = await getCourseActor();
  if (!actor) redirect("/login?callbackUrl=/dashboard/courses");
  const texts = await getSiteTexts();
  if (!canCreateCourse(actor)) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-28 sm:p-6">
        <Link href="/dashboard" className="text-sm text-brand">← บัญชีของฉัน</Link>
        <h1 className="text-2xl font-bold"><Lines text={texts["mycourses.title"]} /></h1>
        <p className="rounded-2xl bg-white p-6 text-neutral-600 shadow-sm">ยังไม่ได้รับสิทธิ์เป็นผู้สร้างคอร์ส — ส่งคำขอได้ที่หน้า <Link href="/dashboard" className="font-semibold text-brand underline">บัญชีของฉัน</Link> แล้วรอผู้ดูแลระบบพิจารณา</p>
      </main>
    );
  }

  const courses = await db.course.findMany({
    where: { createdById: actor.id },
    orderBy: { updatedAt: "desc" },
    include: { area: { select: { name: true, color: true, icon: true } }, _count: { select: { lessons: true, enrollments: true } } },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-brand">← บัญชีของฉัน</Link>
          <h1 className="text-2xl font-bold"><Lines text={texts["mycourses.title"]} /></h1>
          <p className="text-sm text-neutral-500"><Lines text={texts["mycourses.subtitle"]} /></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/courses/guide" className="flex min-h-11 items-center rounded-lg border border-brand px-4 text-sm font-medium text-brand hover:bg-brand-soft">{texts["guide.creator"]}</Link>
          <Link href="/dashboard/courses/new" className="flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white">+ สร้างคอร์ส</Link>
        </div>
      </div>

      {searchParams.saved && SAVED[searchParams.saved] && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">{SAVED[searchParams.saved]}</p>}

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="font-semibold">ยังไม่มีคอร์ส</p>
          <p className="mt-1 text-sm text-neutral-500">สร้างคอร์สจากวิดีโอ ลิงก์ และสื่อที่มี พร้อมแบบฝึกหัดให้ผู้เรียนทำ</p>
          <Link href="/dashboard/courses/new" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white">สร้างคอร์สแรก</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {courses.map((c) => {
            const [label, tone] = COURSE_STATUS_LABEL[c.status];
            const cover = coverOf(c);
            return (
              <li key={c.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg sm:w-36" style={{ backgroundColor: c.area.color }}>
                  {cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={{ objectPosition: `${c.coverFx * 100}% ${c.coverFy * 100}%` }} />
                    : <span className="flex h-full items-center justify-center text-white"><Glyph name={c.area.icon} size={30} strokeWidth={1.4} /></span>}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-2 font-semibold leading-snug">{c.title}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span className={`rounded-full px-2.5 py-0.5 font-medium ${tone}`}>{label}</span>
                    <span>{c.area.name}</span>
                    <span>{c._count.lessons} บท</span>
                    {c.status === "PUBLISHED" && <Link href={`/dashboard/courses/${c.id}/edit?tab=learners`} className="text-brand underline-offset-2 hover:underline">{c._count.enrollments} ผู้เรียน</Link>}
                    <span>แก้ไข {formatThaiDate(c.updatedAt)}</span>
                  </p>
                  {c.status === "REJECTED" && c.reviewNote && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">ส่งกลับ: {c.reviewNote}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link href={`/dashboard/courses/${c.id}/edit`} className="flex min-h-10 items-center rounded-lg border border-neutral-300 px-3 text-sm">แก้ไข</Link>
                    {c.status === "PUBLISHED" && <Link href={`/courses/${c.id}`} className="flex min-h-10 items-center rounded-lg border border-neutral-300 px-3 text-sm">ดูหน้าคอร์ส</Link>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
