"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Glyph from "@/components/glyph";
import type { SearchGroup } from "@/app/api/admin/search/route";

export type SearchPage = { href: string; label: string };
type Row = { title: string; subtitle: string; href: string; group: string };

/**
 * Header search of the back office. Pages of the menu match instantly in the browser; records (media, schools, members,
 * sign-up codes) come from /api/admin/search after a short pause. "/" or Ctrl+K focuses it, arrows + Enter pick a result.
 */
export default function AdminSearch({ pages, compact = false }: { pages: SearchPage[]; compact?: boolean }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const composing = useRef(false);
  const text = q.trim();

  const rows: Row[] = useMemo(() => {
    const low = text.toLowerCase();
    const pageHits = low ? pages.filter((p) => p.label.toLowerCase().includes(low)).slice(0, 4) : [];
    return [
      ...pageHits.map((p) => ({ title: p.label, subtitle: "หน้าในระบบจัดการ", href: p.href, group: "ไปที่หน้า" })),
      ...groups.flatMap((g) => g.hits.map((h) => ({ ...h, group: g.label }))),
    ];
  }, [groups, pages, text]);

  // fetch records (debounced, stale answers dropped)
  useEffect(() => {
    if (!text) { setGroups([]); setLoading(false); setFailed(false); return; }
    setLoading(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      if (composing.current) return;
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(text)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setGroups(((await res.json()) as { groups: SearchGroup[] }).groups);
        setFailed(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") { setFailed(true); setGroups([]); }
      } finally {
        if (!ctl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [text]);

  useEffect(() => setActive(0), [rows.length, text]);

  // "/" and Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", away);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", away); };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    input.current?.blur();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { if (q) setQ(""); else { setOpen(false); input.current?.blur(); } return; }
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => (rows.length ? (a + 1) % rows.length : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (rows.length ? (a - 1 + rows.length) % rows.length : 0)); }
    else if (e.key === "Enter" && rows[active]) { e.preventDefault(); go(rows[active].href); }
  };

  const showPanel = open && text.length > 0;
  let lastGroup = "";

  return (
    <div ref={root} className={`relative ${compact ? "w-full" : "w-full max-w-md"}`}>
      <Glyph name="search" size={16} strokeWidth={2.2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
      <input
        ref={input}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={(e) => { composing.current = false; setQ(e.currentTarget.value); }}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={`${id}-list`}
        aria-activedescendant={showPanel && rows[active] ? `${id}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        enterKeyHint="search"
        placeholder="ค้นหาสื่อ สมาชิก โรงเรียน..."
        aria-label="ค้นหาในระบบจัดการ"
        className="h-10 w-full rounded-xl bg-white/10 pl-9 pr-12 text-sm text-white placeholder:text-white/60 focus:bg-white focus:text-neutral-900 focus:placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/60 [&::-webkit-search-cancel-button]:hidden"
      />
      {!q && <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/30 px-1.5 text-[11px] text-white/70 sm:block" aria-hidden>/</kbd>}
      {q && (
        <button type="button" aria-label="ล้างคำค้น" onClick={() => { setQ(""); input.current?.focus(); }} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/80 hover:bg-white/15">
          <Glyph name="x" size={16} />
        </button>
      )}

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 text-neutral-900 shadow-[0_16px_40px_rgba(15,23,42,0.22)]">
          <ul id={`${id}-list`} role="listbox" aria-label="ผลการค้นหา">
            {rows.map((r, i) => {
              const header = r.group !== lastGroup;
              lastGroup = r.group;
              return (
                <li key={`${r.href}-${i}`} role="presentation">
                  {header && <p className="px-3 pb-1 pt-2 text-xs font-semibold text-neutral-400">{r.group}</p>}
                  <button
                    type="button"
                    id={`${id}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.href)}
                    className={`flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-1.5 text-left ${i === active ? "bg-brand-soft" : ""}`}
                  >
                    <span className="truncate text-sm font-medium">{r.title}</span>
                    <span className="truncate text-xs text-neutral-500">{r.subtitle}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {rows.length === 0 && !loading && <p className="px-3 py-4 text-sm text-neutral-500">{failed ? "ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง" : `ไม่พบผลลัพธ์สำหรับ “${text}”`}</p>}
          {loading && <p className="px-3 py-2 text-xs text-neutral-400" role="status">กำลังค้นหา...</p>}
        </div>
      )}
    </div>
  );
}
