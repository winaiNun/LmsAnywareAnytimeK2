"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type StripItem = { id: string; label: string; href?: string; colors?: [string, string] };

const pill = "inline-flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap rounded-full border px-5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 motion-reduce:transition-none";
const on = "border-transparent bg-brand text-white shadow-md";
const off = "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400";
// auto margins on the first and last pill centre the row while it fits and still let it scroll from its start when it does not
// (justify-content: center would cut off the first tabs of a long row)
const edgeMargin = (i: number, n: number) => `${i === 0 ? "ml-auto" : ""} ${i === n - 1 ? "mr-auto" : ""}`;
const dot = (c?: [string, string]) => (c ? <span aria-hidden className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundImage: `linear-gradient(135deg, ${c[0]}, ${c[1]})` }} /> : null);
const fill = (c?: [string, string]) => (c ? { backgroundImage: `linear-gradient(135deg, ${c[0]}, ${c[1]})`, boxShadow: `0 6px 14px -6px ${c[0]}99` } : undefined);

/**
 * The row of news tabs. It scrolls sideways on a phone (the chosen tab slides into view, the edges fade where more is hidden).
 * mode "tabs": real tab buttons for the home page (arrow keys, Home, End). mode "links": plain links for /news (URL = state).
 */
export default function NewsTabStrip({ items, activeId, onSelect, label, idPrefix }: { items: StripItem[]; activeId: string; onSelect?: (id: string) => void; label: string; idPrefix: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const tabsMode = !!onSelect;

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, items.length]);

  // slide the chosen tab to the middle (without moving the page itself)
  useEffect(() => {
    const el = scroller.current;
    const active = el?.querySelector<HTMLElement>('[data-active="true"]');
    if (!el || !active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [activeId]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!tabsMode) return;
    const i = items.findIndex((x) => x.id === activeId);
    const next = e.key === "ArrowRight" ? (i + 1) % items.length : e.key === "ArrowLeft" ? (i - 1 + items.length) % items.length : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onSelect?.(items[next].id);
    requestAnimationFrame(() => scroller.current?.querySelector<HTMLElement>(`#${CSS.escape(`${idPrefix}-tab-${items[next].id}`)}`)?.focus());
  }

  const mask = `linear-gradient(to right, ${edge.left ? "transparent, black 2rem" : "black, black 0"}, ${edge.right ? "black calc(100% - 2rem), transparent" : "black 100%, black 100%"})`;

  return (
    <div className="relative -mx-4">
      <div
        ref={scroller}
        role={tabsMode ? "tablist" : undefined}
        aria-label={label}
        onScroll={measure}
        onKeyDown={onKeyDown}
        style={{ WebkitMaskImage: mask, maskImage: mask }}
        className="flex snap-x gap-2 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it, idx) =>
          tabsMode ? (
            <button
              key={it.id}
              id={`${idPrefix}-tab-${it.id}`}
              type="button"
              role="tab"
              aria-selected={it.id === activeId}
              aria-controls={`${idPrefix}-panel`}
              tabIndex={it.id === activeId ? 0 : -1}
              data-active={it.id === activeId}
              onClick={() => onSelect?.(it.id)}
              style={it.id === activeId ? fill(it.colors) : undefined}
              className={`${pill} ${edgeMargin(idx, items.length)} ${it.id === activeId ? on : off}`}
            >
              {it.id === activeId ? null : dot(it.colors)}
              {it.label}
            </button>
          ) : (
            <Link key={it.id} href={it.href ?? "#"} aria-current={it.id === activeId ? "page" : undefined} data-active={it.id === activeId} scroll={false} style={it.id === activeId ? fill(it.colors) : undefined} className={`${pill} ${edgeMargin(idx, items.length)} ${it.id === activeId ? on : off}`}>
              {it.id === activeId ? null : dot(it.colors)}
              {it.label}
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
