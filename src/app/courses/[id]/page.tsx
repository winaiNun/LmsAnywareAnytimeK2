import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/breadcrumb";
import Glyph from "@/components/glyph";
import SiteNavbar from "@/components/site-navbar";
import { canPreviewCourse } from "@/lib/course/access";
import { courseCardSelect, instructorOf } from "@/lib/course/course-data";
import { coverOf, getCourseActor } from "@/lib/course/course-server";
import { db } from "@/lib/db";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";
import LearnerCertificate from "@/components/certificate/learner-certificate";
import EnrollButton from "./enroll-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await db.course.findFirst({ where: { id: params.id, status: "PUBLISHED" }, select: { title: true, description: true } });
  return c ? { title: c.title, description: c.description.slice(0, 160) } : { title: "ไม่พบคอร์ส" };
}

const nf = new Intl.NumberFormat("th-TH");

export default async function CoursePage({ params }: { params: { id: string } }) {
  const [actor, texts] = await Promise.all([getCourseActor(), getSiteTexts()]);
  const course = await db.course.findUnique({
    where: { id: params.id },
    select: {
      ...courseCardSelect,
      areaId: true,
      enrollOpen: true,
      reviewNote: true,
      levels: { select: { level: { select: { name: true } } } },
      lessons: { orderBy: { position: "asc" }, select: { id: true, title: true, summary: true, required: true, section: { select: { title: true } }, blocks: { select: { kind: true, required: true } } } },
    },
  });
  if (!course || !canPreviewCourse(actor, { createdById: course.createdBy.id, areaId: course.areaId, status: course.status })) notFound();
  const published = course.status === "PUBLISHED";
  const enrollment = actor && published ? await db.enrollment.findUnique({ where: { userId_courseId: { userId: actor.id, courseId: course.id } }, select: { id: true, completedAt: true } }) : null;
  const preview = !published || (!!actor && !enrollment && actor.id === course.createdBy.id);
  const cover = coverOf(course, 1280);
  const first = course.lessons[0];

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-28 pt-24 md:pb-16">
        <Breadcrumb items={[{ label: plainText(texts["nav.courses"]), href: "/courses" }, { label: course.title.length > 40 ? `${course.title.slice(0, 40)}…` : course.title }]} />
        {!published && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">ตัวอย่างสำหรับผู้สร้างและผู้ตรวจ — คอร์สนี้ยังไม่เผยแพร่ ผู้เรียนทั่วไปยังไม่เห็นหน้านี้</p>}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-neutral-200" style={{ backgroundColor: course.area.color }}>
              {cover
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={cover} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={{ objectPosition: `${course.coverFx * 100}% ${course.coverFy * 100}%` }} />
                : <span className="flex h-full items-center justify-center text-white/90"><Glyph name={course.area.icon} size={64} strokeWidth={1.2} /></span>}
            </div>
          </div>
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold" style={{ backgroundColor: `${course.area.color}1A`, color: course.area.color }}><Glyph name={course.area.icon} size={15} />{course.area.name}</span>
            <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{course.title}</h1>
            <p className="text-neutral-600">ผู้สอน: <strong className="text-neutral-900">{instructorOf(course)}</strong></p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-600">
              <li className="inline-flex items-center gap-1.5"><Glyph name="file-text" size={16} />{course.lessons.length} บทเรียน</li>
              {course.hours !== null && <li className="inline-flex items-center gap-1.5"><Glyph name="calendar-check" size={16} />ประมาณ {course.hours} ชั่วโมง</li>}
              <li className="inline-flex items-center gap-1.5"><Glyph name="users" size={16} />{nf.format(course._count.enrollments)} ผู้เรียน</li>
              {course.levels.length > 0 && <li>{course.levels.map((l) => l.level.name).join(" · ")}</li>}
            </ul>
            <EnrollButton courseId={course.id} signedIn={!!actor} enrolled={!!enrollment} open={course.enrollOpen && published} continueHref={first ? `/courses/${course.id}/learn/${first.id}` : null} preview={preview} />
          </div>
        </div>

        {actor && enrollment?.completedAt && <LearnerCertificate userId={actor.id} courseId={course.id} />}

        <section className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-semibold">เกี่ยวกับคอร์ส</h2>
          <p className="whitespace-pre-line leading-relaxed text-neutral-700">{course.description || "ยังไม่มีคำอธิบาย"}</p>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">เนื้อหาคอร์ส</h2>
          {course.lessons.length === 0 ? <p className="text-sm text-neutral-500">ยังไม่มีบทเรียน</p> : (
            <ol className="divide-y divide-neutral-100">
              {course.lessons.map((l, i) => (
                <li key={l.id}>
                  {l.section && l.section.title !== course.lessons[i - 1]?.section?.title && <p className="pb-1 pt-3 text-sm font-semibold text-brand">{l.section.title}</p>}
                  <div className="flex items-start gap-3 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{l.title}{!l.required && <span className="ml-2 text-xs font-normal text-neutral-500">(ไม่บังคับ)</span>}</p>
                      {l.summary && <p className="text-sm text-neutral-500">{l.summary}</p>}
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-neutral-500">
                        {l.blocks.some((b) => b.kind === "VIDEO") && <span className="inline-flex items-center gap-1"><Glyph name="play-circle" size={13} />วิดีโอ</span>}
                        {l.blocks.some((b) => b.kind === "QUIZ") && <span className="inline-flex items-center gap-1"><Glyph name="clipboard-check" size={13} />แบบฝึกหัด</span>}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
