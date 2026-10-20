"use client";

import { useEffect, useState } from "react";

const KEY = "honors.marquee";
const SECONDS_PER_CARD = 5;

/**
 * Cards drifting from right to left, forever. CSS transform only (no layout work, nothing runs in JS while it moves).
 * It stops on hover / keyboard focus / touch, has its own pause button (remembered in this browser), and for people who
 * ask for reduced motion it is a plain strip they scroll by hand. The list is drawn twice for a seamless loop; the copy is
 * hidden from screen readers and the tab order.
 */
export default function HonorsMarquee({ children, pauseLabel, playLabel }: { children: React.ReactNode[]; pauseLabel: string; playLabel: string }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "paused") setPaused(true);
    } catch {
      /* storage unavailable: start playing */
    }
  }, []);
  const toggle = () => {
    setPaused((p) => {
      try {
        localStorage.setItem(KEY, p ? "playing" : "paused");
      } catch {
        /* ignore */
      }
      return !p;
    });
  };
  const items = (copy: number) => children.map((c, i) => <li key={`${copy}-${i}`} className="w-56 shrink-0 sm:w-60">{c}</li>);

  return (
    <div className="space-y-2">
      <div className="honors-marquee overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,#000_4%,#000_96%,transparent)] motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]" data-paused={paused ? "" : undefined}>
        <div className="honors-track flex w-max gap-4 motion-reduce:animate-none" style={{ animationDuration: `${Math.max(20, children.length * SECONDS_PER_CARD)}s` }}>
          <ul className="flex gap-4" aria-label="สมาชิกที่ได้รับการเชิดชู">{items(0)}</ul>
          {/* the loop copy: not read aloud, not focusable, not shown at all when motion is reduced */}
          <ul className="flex gap-4 motion-reduce:hidden" aria-hidden {...({ inert: "" } as object)}>{items(1)}</ul>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={paused}
        aria-label={paused ? playLabel : pauseLabel}
        title={paused ? playLabel : pauseLabel}
        className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 shadow-sm hover:border-brand motion-reduce:hidden"
      >
        {paused ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
        )}
      </button>
    </div>
  );
}
