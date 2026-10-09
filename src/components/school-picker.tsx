"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { compareThai, normalizeText, sortName } from "@/lib/schools-data";

export type SchoolOption = { id: string; name: string; district: string; center: string };

type Props = {
  schools: SchoolOption[];
  name?: string;
  defaultValue?: string;
  required?: boolean;
  /** "dark" for the glass-on-blue auth pages, "light" for admin/profile forms. */
  tone?: "light" | "dark";
};

/** Searchable school chooser: type any part of a school / district / network-centre name, or browse grouped by district → centre. */
export default function SchoolPicker({ schools, name = "schoolId", defaultValue = "", required, tone = "light" }: Props) {
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const sorted = useMemo(
    () => [...schools].sort((a, b) => compareThai(a.district, b.district) || compareThai(a.center, b.center) || compareThai(sortName(a.name), sortName(b.name))),
    [schools],
  );
  const districts = useMemo(() => [...new Set(sorted.map((s) => s.district))], [sorted]);
  const selected = schools.find((s) => s.id === value);

  const matches = useMemo(() => {
    const q = normalizeText(query);
    return sorted.filter((s) => (!district || s.district === district) && (!q || normalizeText(`${s.name} ${s.district} ${s.center}`).includes(q)));
  }, [sorted, query, district]);

  useEffect(() => setActive(0), [query, district]);
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  function choose(s: SchoolOption) {
    setValue(s.id);
    setQuery("");
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && open && matches[active]) { e.preventDefault(); choose(matches[active]); }
    else if (e.key === "Escape") setOpen(false);
  }

  const dark = tone === "dark";
  const field = dark
    ? "min-h-12 w-full rounded-xl border border-white/30 bg-white/10 px-4 text-white placeholder:text-white/60 focus:border-white focus:outline-none focus:ring-2 focus:ring-white/40"
    : "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  let lastDistrict = "";
  let lastCenter = "";

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={value} />
      {/* Native validation hook: the hidden input cannot be "required", so a visually hidden twin carries it. */}
      {required && <input tabIndex={-1} aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0" required value={value} onChange={() => {}} />}

      {selected && !open ? (
        <button type="button" onClick={() => { setOpen(true); }} className={`${field} flex items-center justify-between gap-2 text-left`}>
          <span>
            <span className="block font-medium">{selected.name}</span>
            <span className={`block text-xs ${dark ? "text-white/70" : "text-neutral-500"}`}>อ.{selected.district} · ศูนย์ {selected.center}</span>
          </span>
          <span className={`text-xs underline ${dark ? "text-white/80" : "text-brand"}`}>เปลี่ยน</span>
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKey}
              placeholder="พิมพ์ชื่อโรงเรียน / อำเภอ / ศูนย์เครือข่าย"
              autoComplete="off"
              enterKeyHint="search"
              className={field}
            />
            <select
              aria-label="กรองตามอำเภอ"
              value={district}
              onChange={(e) => { setDistrict(e.target.value); setOpen(true); }}
              className={`${field} !w-auto max-w-[9rem] shrink-0 ${dark ? "[&>option]:text-neutral-900" : ""}`}
            >
              <option value="">ทุกอำเภอ</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      )}

      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-30 mt-2 max-h-[min(22rem,55dvh)] overflow-y-auto overscroll-contain rounded-xl bg-white py-1 text-neutral-900 shadow-2xl ring-1 ring-black/10">
          {matches.length === 0 && <li className="px-4 py-6 text-center text-sm text-neutral-500">ไม่พบโรงเรียนที่ตรงกับคำค้น</li>}
          {matches.map((s, i) => {
            const head: React.ReactNode[] = [];
            if (s.district !== lastDistrict) {
              lastDistrict = s.district;
              lastCenter = "";
              head.push(<li key={`d-${s.district}`} role="presentation" className="sticky top-0 bg-brand-soft px-4 py-1.5 text-xs font-bold text-brand">อำเภอ{s.district}</li>);
            }
            if (s.center !== lastCenter) {
              lastCenter = s.center;
              head.push(<li key={`c-${s.district}-${s.center}`} role="presentation" className="bg-neutral-50 px-4 py-1 text-xs font-medium text-neutral-500">ศูนย์เครือข่าย {s.center}</li>);
            }
            return [
              ...head,
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={s.id === value}
                onPointerDown={(e) => { e.preventDefault(); choose(s); }}
                onMouseEnter={() => setActive(i)}
                className={`min-h-11 cursor-pointer px-4 py-2.5 text-sm ${i === active ? "bg-brand text-white" : s.id === value ? "bg-brand-soft" : ""}`}
              >
                {s.name}
              </li>,
            ];
          })}
        </ul>
      )}
    </div>
  );
}
