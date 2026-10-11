import Link from "next/link";
import Glyph from "@/components/glyph";

export type NavLesson = { id: string; title: string; sectionTitle: string | null; done: boolean; locked: boolean; required: boolean };

/** The table of contents of a course while learning: done, current and locked lessons. */
export default function LessonNav({ courseId, lessons, currentId, preview }: { courseId: string; lessons: NavLesson[]; currentId: string; preview: boolean }) {
  return (
    <ol className="space-y-0.5" aria-label="บทเรียนในคอร์ส">
      {lessons.map((l, i) => {
        const current = l.id === currentId;
        const heading = l.sectionTitle && l.sectionTitle !== lessons[i - 1]?.sectionTitle;
        const body = (
          <>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${l.done ? "bg-green-600 text-white" : current ? "bg-brand text-white" : "bg-neutral-100 text-neutral-600"}`}>
              {l.done ? <Glyph name="check" size={14} strokeWidth={3} /> : l.locked ? <Glyph name="lock" size={13} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm leading-snug">{l.title}{!l.required && <span className="ml-1 text-xs text-neutral-500">(ไม่บังคับ)</span>}</span>
            {l.locked && <span className="sr-only">(ยังไม่เปิด)</span>}
            {l.done && <span className="sr-only">(เรียนแล้ว)</span>}
          </>
        );
        return (
          <li key={l.id}>
            {heading && <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-brand">{l.sectionTitle}</p>}
            {l.locked && !preview ? (
              <div aria-disabled="true" className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-neutral-400">{body}</div>
            ) : (
              <Link href={`/courses/${courseId}/learn/${l.id}`} aria-current={current ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 ${current ? "bg-brand-soft font-semibold text-brand" : "hover:bg-neutral-50"}`}>{body}</Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
