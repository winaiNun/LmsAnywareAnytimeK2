import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNavbar from "@/components/site-navbar";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Basic public course page (title, description, lesson outline). Enrolment/learning view comes later.
export default async function CoursePage({ params }: { params: { id: string } }) {
  const course = await db.course.findFirst({
    where: { id: params.id, status: "PUBLISHED" },
    include: { lessons: { orderBy: { position: "asc" } }, _count: { select: { enrollments: true } } },
  });
  if (!course) notFound();

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-28 pt-24 md:pb-16">
        <Link href="/#courses" className="text-sm text-brand">← คอร์สทั้งหมด</Link>
        <h1 className="text-3xl font-bold">{course.title}</h1>
        <p className="text-neutral-600">{course.description ?? "ยังไม่มีคำอธิบาย"}</p>
        <p className="text-sm text-neutral-500">{course.lessons.length} บทเรียน · {course._count.enrollments} ผู้เรียน</p>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">เนื้อหาคอร์ส</h2>
          <ol className="divide-y divide-neutral-100">
            {course.lessons.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{l.position}</span>
                {l.title}
              </li>
            ))}
          </ol>
        </section>
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">หน้านี้เป็นหน้าแสดงรายละเอียดเบื้องต้น ระบบลงทะเบียนและเรียนบทเรียนจะเพิ่มในขั้นถัดไป</p>
      </main>
    </>
  );
}
