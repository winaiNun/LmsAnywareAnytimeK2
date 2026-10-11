"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Horizontal strip of cards (home page "latest" / "most viewed"). Swipe on a phone (scroll-snap, the next card peeks
 * in), arrow buttons on wider screens. Children are the cards, rendered on the server.
 */
export default function MediaRail({ label, moreHref, children }: { label: string; moreHref: string; children: React.ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = () => {
    const el = track.current;
    if (el) setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const go = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * (track.current.clientWidth * 0.85), behavior: "smooth" });
  const arrow = "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-xl shadow-md hover:bg-neutral-50 disabled:opacity-0 md:flex";

  return (
    <div className="relative">
      <button type="button" onClick={() => go(-1)} disabled={edge.start} aria-label={`เลื่อนกลับ: ${label}`} className={`${arrow} -left-4`}>‹</button>
      <ul
        ref={track}
        onScroll={measure}
        tabIndex={0}
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-3 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {children}
        <li className="flex w-28 shrink-0 snap-start items-center justify-center">
          <Link href={moreHref} className="flex min-h-12 items-center rounded-full border border-neutral-300 bg-white px-5 text-sm font-semibold text-brand hover:bg-neutral-50">ดูทั้งหมด →</Link>
        </li>
      </ul>
      <button type="button" onClick={() => go(1)} disabled={edge.end} aria-label={`เลื่อนถัดไป: ${label}`} className={`${arrow} -right-4`}>›</button>
    </div>
  );
}

/** Card slot sizes: ~1.4 cards visible on a phone (so the next one peeks), 2 / 3 / 4 on wider screens. */
export const RAIL_ITEM = "w-[72%] shrink-0 snap-start min-[460px]:w-[44%] sm:w-[31%] lg:w-[23.5%]";
