import Link from "next/link";
import Glyph from "@/components/glyph";
import type { CourseCardData } from "@/lib/course/course-data";

const nf = new Intl.NumberFormat("th-TH");

/** One course in a list: 16:9 cover (area colour + icon when there is none), area, title, teacher, and a small facts row. Equal height in a grid. */
export default function CourseCard({ course: c, priority = false }: { course: CourseCardData; priority?: boolean }) {
  return (
    <Link href={`/courses/${c.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
      <div className="relative aspect-video w-full overflow-hidden" style={{ backgroundColor: c.area.color }}>
        {c.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.cover} alt="" loading={priority ? "eager" : "lazy"} referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" style={{ objectPosition: `${c.coverFx * 100}% ${c.coverFy * 100}%` }} />
        ) : (
          <span className="flex h-full items-center justify-center text-white/90"><Glyph name={c.area.icon} size={44} strokeWidth={1.3} /></span>
        )}
        <span className="absolute left-2 top-2 max-w-[85%] truncate rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold shadow-sm" style={{ color: c.area.color }}>{c.area.name}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 min-h-[2.75rem] font-semibold leading-snug group-hover:text-brand">{c.title}</h3>
        <p className="truncate text-sm text-neutral-500">{c.instructor}</p>
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1"><Glyph name="file-text" size={13} />{c.lessons} บท</span>
          {c.hours !== null && <span className="inline-flex items-center gap-1"><Glyph name="calendar-check" size={13} />{c.hours} ชม.</span>}
          <span className="inline-flex items-center gap-1"><Glyph name="users" size={13} />{nf.format(c.learners)} ผู้เรียน</span>
        </p>
      </div>
    </Link>
  );
}
