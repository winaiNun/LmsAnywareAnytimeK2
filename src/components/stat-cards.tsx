"use client";

import { useEffect, useRef, useState } from "react";
import { IconTile } from "@/components/glyph";
import { TONES } from "@/lib/news/palette";
import type { StatCardData } from "@/lib/stats/data";
import { formatStat } from "@/lib/stats/metrics";

// the same colours as the news block, in an order that sits well side by side
const ORDER = [TONES.blue, TONES.teal, TONES.violet, TONES.orange, TONES.rose, TONES.green] as const;
const DURATION = 1200; // ms

/** A number that counts up from 0 the first time it scrolls into view. The server sends the real number, so it is right without JavaScript; reduced motion keeps it. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const el = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node || value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION);
          setShown(Math.round(value * (1 - (1 - t) ** 3))); // ease out
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        setShown(0);
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={el} aria-label={formatStat(value)} className="tabular-nums">
      <span aria-hidden>{formatStat(shown)}</span>
    </span>
  );
}

/**
 * The stat strip under the home banner: a number and a label per card, white cards that overlap the banner's lower edge.
 * `overlap` = false for the admin preview (no pull-up over a banner that is not there).
 */
export default function StatCards({ cards, regionLabel, overlap = true }: { cards: StatCardData[]; regionLabel: string; overlap?: boolean }) {
  if (cards.length === 0) return null;
  return (
    <div className={`relative z-10 mx-auto max-w-6xl px-4 ${overlap ? "-mt-12 sm:-mt-14" : ""}`}>
      <ul role="list" aria-label={regionLabel} className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {cards.map((c, i) => {
          const tone = ORDER[i % ORDER.length];
          return (
            <li key={c.id} className="flex basis-[calc(50%-0.375rem)] md:basis-[calc(25%-0.75rem)]">
              <div className="flex h-[5.75rem] w-full items-center gap-3 rounded-2xl bg-white p-3.5 sm:h-24 shadow-xl shadow-slate-900/10 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-2xl motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:gap-4 sm:p-4">
                <IconTile name={c.icon} color={tone.solid} size={44} className="sm:!h-12 sm:!w-12" />
                <div className="min-w-0">
                  <p className="text-[1.65rem] font-bold leading-none text-neutral-900 sm:text-3xl"><CountUp value={c.value} /></p>
                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-neutral-600 sm:text-sm">{c.label}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
