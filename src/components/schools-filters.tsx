"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { SCHOOL_SORTS, matchesQuery, normalizeText, type SchoolListItem } from "@/lib/schools-data";

type Props = {
  districts: string[];
  centers: { district: string; center: string }[];
  /** Name + place of every school, for the type-ahead suggestions. */
  suggestions: Pick<SchoolListItem, "id" | "name" | "district" | "center" | "code">[];
  initial: { q: string; district: string; center: string; sort: string };
};

const field = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[15px] focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

/**
 * Search + filters for the schools page. Results update while you type (and the moment a filter changes); the URL is
 * kept in sync so every result is shareable. A plain GET form underneath, so Enter and no-JavaScript still work.
 */
export default function SchoolsFilters({ districts, centers, suggestions, initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const composing = useRef(false); // Thai IME composition: wait until the word is committed
  const formRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState(initial.q);
  const [district, setDistrict] = useState(initial.district);
  const [center, setCenter] = useState(initial.center);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  const centerOptions = useMemo(() => centers.filter((c) => !district || c.district === district), [centers, district]);

  const matches = useMemo(() => {
    if (normalizeText(q).length < 1) return [];
    return suggestions.filter((s) => matchesQuery({ ...s, siteUrl: null, cardUrl: null, updatedAt: 0 }, q)).slice(0, 8);
  }, [q, suggestions]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  /** Update the URL (and so the results) from the current values; `over` carries a value React has not committed yet. */
  function push(over: Partial<{ q: string; district: string; center: string }> = {}) {
    const sort = (formRef.current?.elements.namedItem("sort") as HTMLSelectElement | null)?.value ?? initial.sort;
    const v = { q, district, center, ...over };
    const p = new URLSearchParams();
    if (v.q.trim()) p.set("q", v.q.trim());
    if (v.district) p.set("district", v.district);
    if (v.center) p.set("center", v.center);
    if (sort && sort !== "name") p.set("sort", sort);
    start(() => router.replace(`/schools${p.toString() ? `?${p}` : ""}`, { scroll: false }));
  }
  const later = (value: string) => { clearTimeout(timer.current); timer.current = setTimeout(() => push({ q: value }), 250); };
  const hasFilters = !!(initial.q || initial.district || initial.center || (initial.sort && initial.sort !== "name"));

  return (
    <form
      ref={formRef}
      action="/schools"
      method="get"
      role="search"
      aria-label="ค้นหาและกรองโรงเรียน"
      onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); push(); }}
      className="relative space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-3 md:grid-cols-12">
        <div ref={boxRef} className="relative md:col-span-5">
          <label htmlFor={`${listId}-q`} className="mb-1 block text-sm font-medium">ค้นหา (ชื่อโรงเรียน รหัส อำเภอ หรือศูนย์)</label>
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              id={`${listId}-q`}
              name="q"
              value={q}
              autoComplete="off"
              placeholder="พิมพ์เอง เช่น บ้านหนองไผ่ หรือ จักราช 2"
              role="combobox"
              aria-expanded={open && matches.length > 0}
              aria-controls={`${listId}-list`}
              aria-autocomplete="list"
              onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); if (!composing.current) later(e.target.value); }}
              onCompositionStart={() => { composing.current = true; }}
              onCompositionEnd={(e) => { composing.current = false; later((e.target as HTMLInputElement).value); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && matches.length) { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
                else if (e.key === "ArrowUp" && matches.length) { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
                else if (e.key === "Escape") setOpen(false);
                else if (e.key === "Enter" && open && active >= 0) { e.preventDefault(); setQ(matches[active].name); setOpen(false); clearTimeout(timer.current); push({ q: matches[active].name }); }
              }}
              className={`${field} pl-10`}
            />
          </div>
          {open && matches.length > 0 && (
            <ul id={`${listId}-list`} role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-xl">
              {matches.map((m, i) => (
                <li key={m.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setQ(m.name); setOpen(false); clearTimeout(timer.current); push({ q: m.name }); }}
                    className={`flex min-h-11 w-full flex-col rounded-lg px-3 py-1.5 text-left text-sm hover:bg-brand-soft ${i === active ? "bg-brand-soft" : ""}`}
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-neutral-500">อ.{m.district} · {m.center}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-2">
          <label htmlFor={`${listId}-d`} className="mb-1 block text-sm font-medium">อำเภอ</label>
          <select id={`${listId}-d`} name="district" value={district} onChange={(e) => { setDistrict(e.target.value); setCenter(""); push({ district: e.target.value, center: "" }); }} className={field}>
            <option value="">ทุกอำเภอ</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="md:col-span-3">
          <label htmlFor={`${listId}-c`} className="mb-1 block text-sm font-medium">ศูนย์เครือข่าย</label>
          <select id={`${listId}-c`} name="center" value={center} onChange={(e) => { setCenter(e.target.value); push({ center: e.target.value }); }} className={field}>
            <option value="">{district ? `ทุกศูนย์ใน อ.${district}` : "ทุกศูนย์"}</option>
            {centerOptions.map((c) => <option key={`${c.district}-${c.center}`} value={c.center}>{c.center}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor={`${listId}-s`} className="mb-1 block text-sm font-medium">เรียงลำดับ</label>
          <select id={`${listId}-s`} name="sort" defaultValue={initial.sort || "name"} onChange={() => push()} className={field}>
            {SCHOOL_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex min-h-11 flex-wrap items-center gap-3">
        {hasFilters && (
          <Link href="/schools" className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 text-sm hover:bg-neutral-50">ล้างตัวกรอง</Link>
        )}
        <span role="status" className={`text-xs text-neutral-500 transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}>กำลังค้นหา…</span>
      </div>
      <button type="submit" className="sr-only" tabIndex={-1}>ค้นหา</button>
      <span className={`pointer-events-none absolute inset-x-4 bottom-0 h-0.5 overflow-hidden rounded-full transition-opacity ${pending ? "opacity-100" : "opacity-0"}`} aria-hidden>
        <span className="block h-full w-1/3 animate-[livebar_1s_ease-in-out_infinite] rounded-full bg-brand" />
      </span>
    </form>
  );
}
