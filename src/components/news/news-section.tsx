"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import Glyph from "@/components/glyph";
import type { NewsPage } from "@/lib/news/data";
import { tabColors, toneFor } from "@/lib/news/palette";
import NewsCardView, { NewsSkeleton } from "./news-card";
import NewsTabStrip from "./news-tab-strip";

export type NewsSectionTab = { id: string; name: string; pageSize: number };
export type NewsSectionTexts = { empty: string; sourceError: string; tabsLabel: string; more: string };

const key = (tab: string, page: number) => `${tab}:${page}`;
const navBtn = "inline-flex min-h-11 items-center gap-1 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 hover:border-brand/50 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40";

/**
 * The home-page news block: tabs, a page of news, and previous / next. The first page of the first tab comes from the server
 * (`initial`, when it was ready in time); everything else is asked from /api/news without reloading the page.
 */
export default function NewsSection({ tabs, initial, texts, moreHref }: { tabs: NewsSectionTab[]; initial: NewsPage | null; texts: NewsSectionTexts; moreHref: string | null }) {
  const uid = useId().replace(/:/g, "");
  const cache = useRef(new Map<string, NewsPage>(initial ? [[key(initial.tab.id, 1), initial]] : []));
  const [activeId, setActiveId] = useState(initial?.tab.id ?? tabs[0].id);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NewsPage | null>(initial);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const activeIndex = Math.max(0, tabs.indexOf(active));

  useEffect(() => {
    const hit = cache.current.get(key(active.id, page));
    if (hit) {
      setData(hit);
      setFailed(false);
      return;
    }
    setData(null);
    setFailed(false);
    const ctrl = new AbortController();
    fetch(`/api/news?tab=${encodeURIComponent(active.id)}&page=${page}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<NewsPage>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        cache.current.set(key(active.id, page), d);
        if (d.page !== page) setPage(d.page); // the server pulled an out-of-range page back
        else setData(d);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setFailed(true);
      });
    return () => ctrl.abort();
  }, [active.id, page, retry]);

  const loading = !data && !failed;

  return (
    <div className="space-y-4">
      {tabs.length > 1 && (
        <NewsTabStrip
          items={tabs.map((t, i) => ({ id: t.id, label: t.name, colors: tabColors(i) }))}
          activeId={active.id}
          onSelect={(id) => {
            setActiveId(id);
            setPage(1);
          }}
          label={texts.tabsLabel}
          idPrefix={`news${uid}`}
        />
      )}

      <div id={`news${uid}-panel`} role={tabs.length > 1 ? "tabpanel" : undefined} aria-labelledby={tabs.length > 1 ? `news${uid}-tab-${active.id}` : undefined} aria-busy={loading} className="space-y-4">
        {loading && <NewsSkeleton count={Math.min(active.pageSize, 8)} />}

        {failed && (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
            <p className="text-neutral-600">โหลดข่าวไม่สำเร็จ</p>
            <button type="button" onClick={() => setRetry((n) => n + 1)} className={navBtn}>ลองอีกครั้ง</button>
          </div>
        )}

        {data && data.items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-500">{texts.empty}</p>
        )}

        {data && data.items.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.items.map((c, i) => (
              <li key={c.key} className="min-w-0"><NewsCardView card={c} tone={toneFor(activeIndex, (data.page - 1) * active.pageSize + i)} toneWide={toneFor(activeIndex, i + Math.floor(i / 2))} /></li>
            ))}
          </ul>
        )}

        {data && data.failed.length > 0 && (
          <p className="text-center text-xs text-amber-700">{texts.sourceError.replace("{name}", data.failed.join(", "))}</p>
        )}

        {data && data.pages > 1 && (
          <nav aria-label="เลือกหน้าข่าว" className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1} className={navBtn}><Glyph name="chevron-left" size={16} />ก่อนหน้า</button>
            <span className="min-w-28 text-center text-sm tabular-nums text-neutral-600" aria-live="polite">หน้า {data.page} / {data.pages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={data.page >= data.pages} className={navBtn}>ถัดไป<Glyph name="chevron-right" size={16} /></button>
          </nav>
        )}
      </div>

      {/* "see all" sits under the news, in the middle: it carries the tab that is open */}
      {moreHref && (
        <div className="flex justify-center pt-2">
          <Link href={tabs.length > 1 ? `${moreHref}?tab=${encodeURIComponent(active.id)}` : moreHref} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-7 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-dark hover:shadow-lg motion-reduce:transition-none">
            {texts.more}
            <Glyph name="chevron-right" size={16} strokeWidth={2.2} />
          </Link>
        </div>
      )}
    </div>
  );
}
