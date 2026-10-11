/* The whole content of a course laid out for a reviewer / admin: info, every lesson and block, every quiz with its answer key. */
import Glyph from "@/components/glyph";
import SitePageBody from "@/components/site-page-body";
import { instructorOf } from "@/lib/course/course-data";
import { coverOf } from "@/lib/course/course-server";
import type { QuestionRow } from "@/lib/course/quiz/grade";
import { describeCorrect } from "@/lib/course/quiz/reveal";
import { TYPE_LABEL } from "@/lib/course/quiz/schemas";
import { BLOCK_LABEL } from "@/lib/course/blocks";
import { db } from "@/lib/db";

export async function loadCourseForReview(id: string) {
  return db.course.findUnique({
    where: { id },
    include: {
      area: true,
      createdBy: { select: { id: true, name: true, memberType: true } },
      levels: { include: { level: { select: { name: true } } } },
      lessons: { orderBy: { position: "asc" }, include: { section: { select: { title: true } }, blocks: { orderBy: { sortOrder: "asc" }, include: { media: { select: { id: true, title: true, status: true } }, quiz: { select: { id: true, title: true } } } } } },
      quizzes: { orderBy: { createdAt: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } },
      _count: { select: { enrollments: true } },
    },
  });
}
export type ReviewCourse = NonNullable<Awaited<ReturnType<typeof loadCourseForReview>>>;

const mark = "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600";

export default function CourseReviewView({ course: c }: { course: ReviewCourse }) {
  const cover = coverOf(c, 640);
  return (
    <div className="space-y-5">
      <section className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="aspect-video w-32 shrink-0 overflow-hidden rounded-lg sm:w-48" style={{ backgroundColor: c.area.color }}>
          {cover
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={cover} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={{ objectPosition: `${c.coverFx * 100}% ${c.coverFy * 100}%` }} />
            : <span className="flex h-full items-center justify-center text-white"><Glyph name={c.area.icon} size={32} strokeWidth={1.4} /></span>}
        </div>
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold leading-snug">{c.title}</h1>
          <p className="text-sm text-neutral-600">{c.area.name}{c.levels.length ? ` · ${c.levels.map((l) => l.level.name).join(", ")}` : ""}</p>
          <p className="text-sm text-neutral-600">ผู้สอน: {instructorOf(c)} · ผู้สร้างบัญชี: {c.createdBy.name}{c.hours !== null ? ` · ${c.hours} ชั่วโมง` : ""}</p>
          <p className="whitespace-pre-line text-sm text-neutral-700">{c.description}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">บทเรียน ({c.lessons.length})</h2>
        {c.lessons.map((l, i) => (
          <article key={l.id} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            {l.section && l.section.title !== c.lessons[i - 1]?.section?.title && <p className="text-sm font-semibold text-brand">{l.section.title}</p>}
            <h3 className="flex flex-wrap items-center gap-2 font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>{l.title}
              {l.unlockRule === "AFTER_PREVIOUS" && <span className={mark}>เปิดหลังจบบทก่อนหน้า</span>}{!l.required && <span className={mark}>ไม่บังคับ</span>}</h3>
            {l.summary && <p className="text-sm text-neutral-600">{l.summary}</p>}
            {l.blocks.length === 0 && <p className="text-sm text-red-600">ยังไม่มีเนื้อหา</p>}
            <ul className="space-y-2">
              {l.blocks.map((b) => (
                <li key={b.id} className="rounded-xl border border-neutral-200 p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">{BLOCK_LABEL[b.kind]}{b.label && <span className="text-neutral-600">— {b.label}</span>}{b.kind === "QUIZ" && b.required && <span className={mark}>คำถามปลดล็อก</span>}</p>
                  {(b.kind === "VIDEO" || b.kind === "LINK") && b.url && <a href={b.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-brand underline">{b.url}<Glyph name="external-link" size={13} className="shrink-0" /></a>}
                  {b.kind === "MEDIA" && (b.media ? <a href={`/library/${b.media.id}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-brand underline">{b.media.title}<Glyph name="external-link" size={13} /></a> : <span className="mt-1 block text-red-600">สื่อนี้ถูกลบแล้ว</span>)}
                  {b.kind === "TEXT" && b.text && <div className="mt-2 rounded-lg bg-neutral-50 p-3"><SitePageBody body={b.text} /></div>}
                  {b.kind === "QUIZ" && <p className="mt-1 text-neutral-600">{b.quiz ? `แบบทดสอบ “${b.quiz.title}” (ดูคำถามและเฉลยด้านล่าง)` : <span className="text-red-600">แบบทดสอบนี้ถูกลบแล้ว</span>}</p>}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      {c.quizzes.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">แบบทดสอบและเฉลย</h2>
          {c.quizzes.map((q) => (
            <article key={q.id} className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="font-semibold">{q.title} <span className="text-sm font-normal text-neutral-500">· ผ่าน {q.passPercent}% · {q.maxAttempts ? `ทำได้ ${q.maxAttempts} ครั้ง` : "ทำได้ไม่จำกัด"}{q.timeLimitMin ? ` · ${q.timeLimitMin} นาที` : ""}</span></h3>
              <ol className="space-y-2">
                {(q.questions as unknown as QuestionRow[]).map((x, i) => (
                  <li key={x.id} className="rounded-xl border border-neutral-200 p-3 text-sm">
                    <p className="text-xs text-neutral-500">ข้อ {i + 1} · {TYPE_LABEL[x.type]} · {x.points} คะแนน</p>
                    <p className="whitespace-pre-line font-medium">{x.prompt}</p>
                    <p className="mt-1 rounded-lg bg-green-50 px-2 py-1 text-green-800"><strong>เฉลย:</strong> {describeCorrect(x) || "—"}</p>
                    {x.explanation && <p className="mt-1 whitespace-pre-line text-neutral-600">{x.explanation}</p>}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
