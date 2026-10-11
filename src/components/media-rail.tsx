"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Glyph from "@/components/glyph";

/**
 * Horizontal strip of cards (home page "latest" / "most viewed").
 * Phone: swipe left / right (native touch scrolling with snap, the next card peeks in, a thin progress bar shows where you are).
 * Wider screens: round arrow buttons on both sides + keyboard (arrow keys) + mouse wheel / trackpad.
 */
export default function MediaRail({ label, moreHref, children }: { label: string; moreHref: string; children: React.ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ start: true, end: false, thumb: 100, left: 0 });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setPos({
      start: el.scrollLeft < 8,
      end: el.scrollLeft >= max - 8,
      thumb: Math.min(100, (el.clientWidth / el.scrollWidth) * 100),
      left: max > 0 ? (el.scrollLeft / el.scrollWidth) * 100 : 0,
    });
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    return () => ro.disconnect();
  }, [measure]);

  const go = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: "smooth" });
  const arrow =
    "absolute top-[38%] z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-[0_6px_20px_rgba(15,23,42,0.18)] ring-1 ring-black/5 backdrop-blur transition hover:scale-105 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:pointer-events-none disabled:scale-90 disabled:opacity-0 md:flex";

  return (
    <div className="relative">
      <button type="button" onClick={() => go(-1)} disabled={pos.start} aria-label={`เลื่อนกลับ: ${label}`} className={`${arrow} -left-5`}>
        <Glyph name="chevron-left" size={24} strokeWidth={2} />
      </button>

      <ul
        ref={track}
        onScroll={measure}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
        }}
        tabIndex={0}
        aria-label={`${label} (เลื่อนซ้ายขวาเพื่อดูเพิ่ม)`}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] focus-visible:outline-none sm:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {children}
        <li className="flex w-32 shrink-0 snap-start items-center justify-center">
          <Link href={moreHref} className="group flex flex-col items-center gap-2 text-sm font-semibold text-brand">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/30 bg-white shadow-sm transition group-hover:bg-brand group-hover:text-white">
              <Glyph name="chevron-right" size={22} strokeWidth={2} />
            </span>
            ดูทั้งหมด
          </Link>
        </li>
      </ul>

      <button type="button" onClick={() => go(1)} disabled={pos.end} aria-label={`เลื่อนถัดไป: ${label}`} className={`${arrow} -right-5`}>
        <Glyph name="chevron-right" size={24} strokeWidth={2} />
      </button>

      {/* where am I: a thin track with a thumb (also a hint that the strip can be swiped) */}
      {pos.thumb < 100 && (
        <div className="mx-auto mt-1 h-1 w-28 overflow-hidden rounded-full bg-black/10" aria-hidden>
          <div className="h-full rounded-full bg-brand transition-[margin] duration-150" style={{ width: `${pos.thumb}%`, marginLeft: `${pos.left}%` }} />
        </div>
      )}
    </div>
  );
}

/** Card slot sizes: ~1.4 cards visible on a phone (so the next one peeks), 2 / 3 / 4 on wider screens. */
export const RAIL_ITEM = "w-[72%] shrink-0 snap-start min-[460px]:w-[44%] sm:w-[31%] lg:w-[23.5%]";
