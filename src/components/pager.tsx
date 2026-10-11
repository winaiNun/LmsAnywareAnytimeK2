import Link from "next/link";
import Glyph from "@/components/glyph";

/** Page numbers to show: always first/last, a window around the current page, "…" for the gaps. */
export function pageWindow(page: number, pages: number, around = 1): (number | "gap")[] {
  const keep = new Set<number>([1, pages]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= pages) keep.add(p);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

const base = "flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg border px-3 text-sm tabular-nums";

/** Accessible pagination. `href(page)` builds the link, so filters in the URL are kept. */
export default function Pager({ page, pages, href, label = "เลือกหน้า" }: { page: number; pages: number; href: (page: number) => string; label?: string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${base} border-neutral-300 bg-white hover:bg-neutral-50`}>
          <Glyph name="chevron-left" size={16} /> ก่อนหน้า
        </Link>
      ) : (
        <span className={`${base} border-neutral-200 text-neutral-300`} aria-disabled><Glyph name="chevron-left" size={16} /> ก่อนหน้า</span>
      )}
      {pageWindow(page, pages).map((p, i) =>
        p === "gap" ? (
          <span key={`g${i}`} className="px-1 text-neutral-400" aria-hidden>…</span>
        ) : p === page ? (
          <span key={p} aria-current="page" className={`${base} border-brand bg-brand font-semibold text-white`}>{p}</span>
        ) : (
          <Link key={p} href={href(p)} aria-label={`หน้า ${p}`} className={`${base} border-neutral-300 bg-white hover:bg-neutral-50`}>{p}</Link>
        ),
      )}
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={`${base} border-neutral-300 bg-white hover:bg-neutral-50`}>
          ถัดไป <Glyph name="chevron-right" size={16} />
        </Link>
      ) : (
        <span className={`${base} border-neutral-200 text-neutral-300`} aria-disabled>ถัดไป <Glyph name="chevron-right" size={16} /></span>
      )}
    </nav>
  );
}
