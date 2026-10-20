import Link from "next/link";
import Avatar from "@/components/avatar";
import Glyph from "@/components/glyph";
import type { HonorMember } from "@/lib/honors";
import type { HonorTab } from "@/lib/honors-rank";

const nf = new Intl.NumberFormat("th-TH");
const MEDAL = ["bg-amber-400 text-amber-950", "bg-slate-300 text-slate-800", "bg-orange-300 text-orange-950"];

/** The headline number of a tab ("24 สื่อ" on the media tab ...). */
export function metricOf(m: HonorMember, tab: HonorTab): string {
  switch (tab) {
    case "courses":
      return `${nf.format(m.courseCount)} คอร์ส`;
    case "likes":
      return `${nf.format(m.likes)} ถูกใจ`;
    case "views":
      return `${nf.format(m.views)} ครั้งที่ถูกดู`;
    default:
      return `${nf.format(m.mediaCount)} สื่อ · ${nf.format(m.courseCount)} คอร์ส`;
  }
}

/**
 * One honoured member. Only what the member chose to show reaches this component (see lib/honors.ts), so there is nothing to hide here.
 * `compact` = the fixed-width card of the home carousel; `rank` adds a medal for the top three.
 */
export default function HonorCard({ m, tab = "all", rank, compact = false }: { m: HonorMember; tab?: HonorTab; rank?: number; compact?: boolean }) {
  return (
    <Link
      href={`/honors/${m.id}`}
      className={`group relative flex h-full flex-col items-center gap-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white text-center shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${compact ? "p-4" : "p-5"}`}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-brand-soft to-transparent" />
      {rank !== undefined && rank < 3 && (
        <span className={`absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow ${MEDAL[rank]}`} aria-label={`อันดับ ${rank + 1}`}>{rank + 1}</span>
      )}
      <Avatar avatar={m.avatar} name={m.name} size={compact ? 72 : 88} className="relative ring-4 ring-white shadow" />
      <div className="relative min-w-0 max-w-full">
        <h3 className="line-clamp-2 font-semibold leading-snug group-hover:text-brand">{m.name}</h3>
        {m.position && <p className="truncate text-xs text-neutral-500">{m.position}</p>}
        {m.subtitle && <p className="truncate text-xs text-neutral-500">{m.subtitle}</p>}
      </div>
      {m.bio && !compact && <p className="line-clamp-2 text-sm text-neutral-600">{m.bio}</p>}
      <p className="relative mt-auto inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand"><Glyph name="trophy" size={13} />{metricOf(m, tab)}</p>
      {m.badges.length > 0 && !compact && (
        <ul className="relative flex flex-wrap justify-center gap-1" aria-label="เหรียญตรา">
          {m.badges.slice(-3).map((b) => <li key={b.key} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">{b.label}</li>)}
        </ul>
      )}
    </Link>
  );
}
