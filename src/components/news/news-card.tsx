import Glyph from "@/components/glyph";
import type { NewsCard } from "@/lib/news/merge";
import { TONES, type Tone } from "@/lib/news/palette";
import { THAI_MONTHS_SHORT, bangkokParts, toBE } from "@/lib/thai-date";
import NewsThumb from "./news-thumb";

/** The date as a small block: big day, short month, Buddhist year. */
function DateBlock({ iso }: { iso: string | null }) {
  const box = "bg-[color:var(--soft)] text-[color:var(--tone)]";
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return (
      <span className={`flex h-[4.5rem] w-14 shrink-0 items-center justify-center rounded-xl sm:h-20 sm:w-16 ${box}`} aria-hidden>
        <Glyph name="newspaper" size={26} />
      </span>
    );
  }
  const p = bangkokParts(d);
  return (
    <time dateTime={d.toISOString()} className={`flex h-[4.5rem] w-14 shrink-0 flex-col items-center justify-center rounded-xl leading-none sm:h-20 sm:w-16 ${box}`}>
      <span className="text-2xl font-bold tabular-nums sm:text-[1.75rem]">{p.day}</span>
      <span className="mt-1 text-xs font-semibold">{THAI_MONTHS_SHORT[p.month - 1]}</span>
      <span className="mt-0.5 text-[10px] tabular-nums opacity-70">{toBE(p.year)}</span>
    </time>
  );
}

/** One news entry. The whole card is the link; it opens in a new tab because the story lives on another site. */
/**
 * `tone` colours the card in a one-column list (phones); `toneWide` in the two-column list (md and up), where the colours are
 * staggered row by row so neighbours never match across or down: a checkerboard instead of two colour stripes.
 */
export default function NewsCardView({ card, tone = TONES.blue, toneWide = tone }: { card: NewsCard; tone?: Tone; toneWide?: Tone }) {
  return (
    <a
      href={card.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{ "--tm": tone.solid, "--sm": tone.soft, "--tw": toneWide.solid, "--sw": toneWide.soft } as React.CSSProperties}
      className={`group flex h-[7.75rem] [--tone:var(--tm)] [--soft:var(--sm)] md:[--tone:var(--tw)] md:[--soft:var(--sw)] gap-3 overflow-hidden rounded-2xl border border-l-4 border-l-[color:var(--tone)] bg-white p-3 pl-2.5 sm:h-32 shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[color:var(--tone)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${card.pinned ? "border-[color:var(--tone)]/40 ring-1 ring-[color:var(--tone)]/20" : "border-neutral-200"}`}
    >
      <DateBlock iso={card.date} />
      <span className="flex min-w-0 flex-1 flex-col justify-between gap-1 py-0.5">
        {/* every card has the same height: the headline (up to 2 lines) and note sit on top, the meta row at the bottom */}
        <span className="flex min-w-0 flex-col gap-1">
          <span className="line-clamp-2 break-words text-[15px] font-semibold leading-snug text-neutral-900 transition group-hover:text-[color:var(--tone)] sm:text-base">{card.title}</span>
          {card.note && <span className="line-clamp-1 break-words text-xs text-neutral-500 sm:text-sm">{card.note}</span>}
        </span>
        <span className="flex flex-nowrap items-center gap-x-2 text-xs text-neutral-500">
          {card.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--tone)] px-2 py-0.5 text-[11px] font-medium text-white"><Glyph name="pin" size={11} />ปักหมุด</span>
          )}
          {card.source && <span className="min-w-0 max-w-[11rem] truncate rounded-full bg-[color:var(--soft)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--tone)]">{card.source}</span>}
          <span className="ml-auto inline-flex items-center gap-1 text-[color:var(--tone)] opacity-80 transition group-hover:opacity-100">เปิดอ่าน<Glyph name="external-link" size={13} /></span>
        </span>
      </span>
      {card.image && <NewsThumb src={card.image} />}
    </a>
  );
}

/** The loading frame: the same shape as a card, so the page does not jump. */
export function NewsSkeleton({ count }: { count: number }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex h-[7.75rem] animate-pulse gap-3 sm:h-32 rounded-2xl border border-neutral-200 bg-white p-3 motion-reduce:animate-none">
          <span className="h-[4.5rem] w-14 shrink-0 rounded-xl bg-neutral-100 sm:h-20 sm:w-16" />
          <span className="flex flex-1 flex-col justify-center gap-2">
            <span className="h-3.5 w-11/12 rounded bg-neutral-100" />
            <span className="h-3.5 w-7/12 rounded bg-neutral-100" />
            <span className="h-3 w-1/4 rounded bg-neutral-100" />
          </span>
        </li>
      ))}
    </ul>
  );
}
