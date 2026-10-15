import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Breadcrumb from "@/components/breadcrumb";
import ConfirmButton from "@/components/course/confirm-button";
import LessonNav, { type NavLesson } from "@/components/course/lesson-nav";
import QuizBlock from "@/components/course/quiz-block";
import Glyph from "@/components/glyph";
import MediaViewer from "@/components/media-viewer";
import SitePageBody from "@/components/site-page-body";
import SiteNavbar from "@/components/site-navbar";
import { canPreviewCourse } from "@/lib/course/access";
import { youtubeStart, youtubeVideoId } from "@/lib/course/blocks";
import { accessLesson, loadCourseState, quizStatusFor, reasonText, touchLessonAs } from "@/lib/course/course-learn";
import { getCourseActor } from "@/lib/course/course-server";
import { isLessonUnlocked, needsConfirm } from "@/lib/course/rules";
import { db } from "@/lib/db";
import { toViewItem, type ViewItem } from "@/lib/media-view";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "เรียนคอร์ส", robots: { index: false } };

export default async function LearnPage({ params }: { params: { id: string; lessonId: string } }) {
  const [actor, texts] = await Promise.all([getCourseActor(), getSiteTexts()]);
  if (!actor) redirect(`/login?callbackUrl=/courses/${params.id}/learn/${params.lessonId}`);

  const course = await db.course.findUnique({ where: { id: params.id }, select: { id: true, title: true, status: true, areaId: true, createdById: true } });
  if (!course) notFound();

  const state = await loadCourseState(actor.id, course.id);
  if (!state) notFound();
  // a published course is visible to everybody, but only its author, its reviewers and admins may open it without enrolling
  const mayPreview = canPreviewCourse(actor, { createdById: course.createdById, areaId: course.areaId, status: "PENDING" });
  const enrolled = !!state.enrollment && course.status === "PUBLISHED";
  // an author / reviewer / admin who is not learning this course sees it as a preview: nothing is recorded
  const preview = !enrolled && mayPreview;

  let lessonIndex: number;
  if (preview) {
    lessonIndex = state.lessons.findIndex((l) => l.id === params.lessonId);
    if (lessonIndex < 0) notFound();
  } else {
    const a = await accessLesson(actor.id, course.id, params.lessonId);
    if (!a.ok) {
      if (a.reason === "no-course" || a.reason === "no-lesson") notFound();
      return <Blocked courseId={course.id} title={course.title} message={reasonText(a.reason)} reason={a.reason} />;
    }
    lessonIndex = a.index;
    await touchLessonAs(actor.id, course.id, params.lessonId);
  }

  const lesson = state.lessons[lessonIndex];
  const lessonRow = await db.lesson.findUnique({
    where: { id: lesson.id },
    select: {
      blocks: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, kind: true, label: true, url: true, text: true, required: true,
          media: { select: { id: true, title: true, status: true, items: { orderBy: { sortOrder: "asc" }, select: { id: true, kind: true, label: true, url: true, storageKey: true, mimeType: true, sizeBytes: true } } } }, // no html body here: an HTML app is framed from its own route, so up to 500 KB per item is not read on every view
          quiz: { select: { id: true, title: true, passPercent: true, maxAttempts: true, timeLimitMin: true, _count: { select: { questions: true } } } },
        },
      },
    },
  });
  if (!lessonRow) notFound();

  const done = state.done;
  const nav: NavLesson[] = state.lessons.map((l, i) => ({ id: l.id, title: l.title, sectionTitle: l.sectionTitle, done: done.has(l.id), locked: !isLessonUnlocked(state.lessons, i, done), required: l.required }));
  const prev = state.lessons[lessonIndex - 1] ?? null;
  const next = state.lessons[lessonIndex + 1] ?? null;
  const nextOpen = !!next && (preview || isLessonUnlocked(state.lessons, lessonIndex + 1, done));
  const lessonDone = done.has(lesson.id);
  const confirmed = state.learner.confirmed.has(lesson.id);
  const showConfirm = !preview && needsConfirm(lesson);
  const progress = state.enrollment?.progress ?? 0;
  const complete = !!state.enrollment?.completedAt;

  const blocks = await Promise.all(lessonRow.blocks.map(async (b) => {
    let view: React.ReactNode = null;
    if (b.kind === "VIDEO") {
      const videoId = youtubeVideoId(b.url);
      const start = youtubeStart(b.url);
      // the same viewer as every other embed: the frame, "open in a new page" (YouTube itself) and "full screen here"
      const video: ViewItem | null = videoId
        ? { id: b.id, kind: "YOUTUBE", kindLabel: "วิดีโอ YouTube", label: b.label || "วิดีโอประกอบบทเรียน", provider: "YouTube", frameSrc: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&start=${start}`, shape: "video", openUrl: `https://www.youtube.com/watch?v=${videoId}${start > 0 ? `&t=${start}s` : ""}`, downloadUrl: null, isHtml: false, sizeBytes: null }
        : null;
      view = video
        ? (
          <div className="space-y-2">
            {b.label && <p className="font-semibold">{b.label}</p>}
            <MediaViewer item={video} mediaId={null} />
          </div>
        )
        : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">วิดีโอนี้ไม่ใช่ลิงก์ YouTube ที่เปิดได้ — แจ้งผู้สอน</p>;
    } else if (b.kind === "LINK") {
      const item = toViewItem({ id: b.id, kind: "LINK", label: b.label, url: b.url, storageKey: null, mimeType: null, sizeBytes: null, html: null });
      view = <div className="space-y-2">{b.label && <p className="font-semibold">{b.label}</p>}<MediaViewer item={item} mediaId={null} /></div>;
    } else if (b.kind === "MEDIA") {
      const m = b.media;
      view = !m || m.status !== "PUBLISHED" || m.items.length === 0
        ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">สื่อประกอบบทนี้ยังไม่พร้อมใช้งาน</p>
        : (
          <div className="space-y-3">
            <p className="font-semibold">{b.label || m.title}</p>
            {m.items.map((it) => <div key={it.id} className="space-y-2">{it.label && m.items.length > 1 && <p className="text-sm font-medium">{it.label}</p>}<MediaViewer item={toViewItem({ ...it, html: null })} mediaId={null} /></div>)}
          </div>
        );
    } else if (b.kind === "HTML") {
      // framed from its own route (sandboxed, and only for people who may open this lesson); the HTML itself is not loaded here
      const src = `/courses/${course.id}/html/${b.id}`;
      const item: ViewItem = { id: b.id, kind: "HTML", kindLabel: "HTML", label: b.label || "เนื้อหา HTML", provider: "HTML", frameSrc: src, shape: "tall", openUrl: src, downloadUrl: null, isHtml: true, sizeBytes: null };
      view = <div className="space-y-2">{b.label && <p className="font-semibold">{b.label}</p>}<MediaViewer item={item} mediaId={null} /></div>;
    } else if (b.kind === "TEXT") {
      view = <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">{b.label && <p className="mb-2 font-semibold">{b.label}</p>}<SitePageBody body={b.text ?? ""} /></div>;
    } else if (b.kind === "QUIZ" && b.quiz) {
      if (preview) {
        view = <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-600">แบบทดสอบ “{b.quiz.title}” ({b.quiz._count.questions} ข้อ) — ในโหมดตัวอย่างลองทำได้ที่ <Link className="font-medium text-brand underline" href={`/dashboard/courses/${course.id}/edit`}>หน้าแก้ไขคอร์ส</Link></p>;
      } else {
        const status = await quizStatusFor(actor.id, b.quiz.id, b.quiz.maxAttempts, b.quiz.timeLimitMin);
        view = <QuizBlock courseId={course.id} quiz={{ id: b.quiz.id, title: b.quiz.title, passPercent: b.quiz.passPercent, maxAttempts: b.quiz.maxAttempts, timeLimitMin: b.quiz.timeLimitMin, questionCount: b.quiz._count.questions }} status={status} required={b.required} />;
      }
    }
    return <div key={b.id}>{view}</div>;
  }));

  const toc = (
    <>
      {!preview && <div className="mx-2 mb-2 h-2 overflow-hidden rounded-full bg-neutral-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้าของคอร์ส"><div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} /></div>}
      <LessonNav courseId={course.id} lessons={nav} currentId={lesson.id} preview={preview} />
    </>
  );
  const courseHref = `/courses/${course.id}`;
  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-24 md:pb-16">
        <Breadcrumb items={[{ label: plainText(texts["nav.courses"]), href: "/courses" }, { label: course.title.length > 36 ? `${course.title.slice(0, 36)}…` : course.title, href: courseHref }, { label: lesson.title.length > 30 ? `${lesson.title.slice(0, 30)}…` : lesson.title }]} />
        {preview && <p role="status" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">โหมดตัวอย่าง — เปิดได้ทุกบทและไม่บันทึกความคืบหน้า</p>}

        <div className="mt-4 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <details className="rounded-2xl border border-neutral-200 bg-white lg:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold">
                <span>สารบัญคอร์ส</span>
                {!preview && <span className="text-sm font-normal text-neutral-600">{progress}%</span>}
              </summary>
              <div className="border-t border-neutral-100 p-2">{toc}</div>
            </details>
            <div className="hidden rounded-2xl border border-neutral-200 bg-white lg:block">
              <p className="flex min-h-12 items-center justify-between gap-3 px-4 font-semibold"><span>สารบัญคอร์ส</span>{!preview && <span className="text-sm font-normal text-neutral-600">{progress}%</span>}</p>
              <div className="border-t border-neutral-100 p-2">{toc}</div>
            </div>
          </aside>

          <article className="min-w-0 space-y-5">
            <header className="space-y-1">
              {lesson.sectionTitle && <p className="text-sm font-semibold text-brand">{lesson.sectionTitle}</p>}
              <h1 className="text-2xl font-bold leading-snug">{lesson.title}</h1>
              {lesson.summary && <p className="text-neutral-600">{lesson.summary}</p>}
            </header>

            {complete && !preview && (
              <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 font-semibold text-green-800"><Glyph name="trophy" size={20} />คุณเรียนจบคอร์สนี้แล้ว</p>
            )}

            {blocks.length === 0 ? <p className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">บทนี้ยังไม่มีเนื้อหา</p> : <div className="space-y-6">{blocks}</div>}

            {!preview && (
              <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
                {lessonDone && !showConfirm ? (
                  <p className="inline-flex items-center gap-1.5 font-semibold text-green-700"><Glyph name="check" size={18} strokeWidth={2.6} />เรียนบทนี้ครบแล้ว</p>
                ) : showConfirm ? (
                  <ConfirmButton courseId={course.id} lessonId={lesson.id} confirmed={confirmed} />
                ) : (
                  <p className="text-sm text-neutral-600">บทนี้จะเปิดบทถัดไปเมื่อตอบ “คำถามปลดล็อก” ด้านบนให้ถูกทั้งหมด</p>
                )}
              </div>
            )}

            <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="เลื่อนบทเรียน">
              {prev ? <Link href={`/courses/${course.id}/learn/${prev.id}`} className="inline-flex min-h-12 items-center gap-1 rounded-xl border border-neutral-300 bg-white px-5 font-medium hover:bg-neutral-50"><Glyph name="chevron-left" size={18} />บทก่อนหน้า</Link> : <span />}
              {next ? (
                nextOpen
                  ? <Link href={`/courses/${course.id}/learn/${next.id}`} className="inline-flex min-h-12 items-center gap-1 rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">บทถัดไป<Glyph name="chevron-right" size={18} /></Link>
                  : <span className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-neutral-100 px-5 text-sm text-neutral-500"><Glyph name="lock" size={16} />เรียนบทนี้ให้ครบเพื่อปลดล็อกบทถัดไป</span>
              ) : <Link href={courseHref} className="inline-flex min-h-12 items-center rounded-xl border border-neutral-300 bg-white px-5 font-medium hover:bg-neutral-50">กลับหน้าคอร์ส</Link>}
            </nav>
          </article>
        </div>
      </main>
    </>
  );
}

function Blocked({ courseId, title, message, reason }: { courseId: string; title: string; message: string; reason: string }) {
  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-xl space-y-4 px-4 pb-28 pt-28 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"><Glyph name="lock" size={26} /></span>
        <h1 className="text-xl font-bold">{message}</h1>
        <p className="text-neutral-600">{title}</p>
        <Link href={`/courses/${courseId}`} className="inline-flex min-h-12 items-center rounded-xl bg-brand px-7 font-semibold text-white hover:bg-brand-dark">{reason === "not-enrolled" ? "ไปลงทะเบียนที่หน้าคอร์ส" : "กลับหน้าคอร์ส"}</Link>
      </main>
    </>
  );
}
