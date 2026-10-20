import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canEditCourse } from "@/lib/course/access";
import { getCourseActor } from "@/lib/course/course-server";
import { db } from "@/lib/db";
import { getSiteInfo } from "@/lib/site";
import { BlocksEditor, LessonSettings } from "./lesson-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "แก้ไขบทเรียน" };

export default async function EditLessonPage({ params }: { params: { id: string; lessonId: string } }) {
  const actor = await getCourseActor();
  if (!actor) redirect(`/login?callbackUrl=/dashboard/courses/${params.id}/lessons/${params.lessonId}`);
  const lesson = await db.lesson.findFirst({
    where: { id: params.lessonId, courseId: params.id },
    include: {
      section: { select: { title: true } },
      blocks: { orderBy: { sortOrder: "asc" }, include: { media: { select: { title: true } } } },
      course: { select: { id: true, title: true, createdById: true, areaId: true, sections: { select: { title: true }, orderBy: { sortOrder: "asc" } }, quizzes: { select: { id: true, title: true }, orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!lesson || !canEditCourse(actor, lesson.course)) notFound();
  const all = await db.lesson.findMany({ where: { courseId: params.id }, orderBy: { position: "asc" }, select: { id: true } });
  const index = all.findIndex((l) => l.id === lesson.id);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <Link href={`/dashboard/courses/${params.id}/edit?tab=content`} className="text-sm text-brand">← {lesson.course.title}</Link>
        <h1 className="text-2xl font-bold"><span className="text-brand">บทที่ {index + 1}</span> {lesson.title}</h1>
      </div>
      <LessonSettings
        courseId={params.id}
        lesson={{ id: lesson.id, title: lesson.title, summary: lesson.summary, unlockRule: lesson.unlockRule, required: lesson.required, sectionTitle: lesson.section?.title ?? "" }}
        sections={lesson.course.sections.map((s) => s.title)}
      />
      <BlocksEditor
        uploadsOpen={(await getSiteInfo()).allowServerUploads}
        courseId={params.id}
        lessonId={lesson.id}
        quizzes={lesson.course.quizzes}
        blocks={lesson.blocks.map((b) => ({ id: b.id, kind: b.kind, label: b.label, url: b.url ?? "", mediaId: b.mediaId ?? "", mediaTitle: b.media?.title ?? "", text: b.text ?? "", html: b.html ?? "", quizId: b.quizId ?? "", required: b.required }))}
      />
      <div className="flex justify-between gap-3">
        {index > 0 ? <Link href={`/dashboard/courses/${params.id}/lessons/${all[index - 1].id}`} className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 text-sm">← บทก่อนหน้า</Link> : <span />}
        {index < all.length - 1 ? <Link href={`/dashboard/courses/${params.id}/lessons/${all[index + 1].id}`} className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 text-sm">บทถัดไป →</Link> : <Link href={`/dashboard/courses/${params.id}/edit?tab=quizzes`} className="flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">ต่อไป: แบบทดสอบ →</Link>}
      </div>
    </main>
  );
}
