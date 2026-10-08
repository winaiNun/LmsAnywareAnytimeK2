"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { LinkGroup, LinkOption } from "@/lib/link-targets";
import { isExternalUrl } from "@/lib/slideshow";

/**
 * Destination field: type any link, or pick from a live list of pages, courses and media.
 * `onValueChange` lets the form react (e.g. force "open in new tab" for external links).
 */
export default function LinkPicker({
  name,
  defaultValue = "",
  groups,
  onValueChange,
  onPick,
}: {
  name: string;
  defaultValue?: string;
  groups: LinkGroup[];
  onValueChange?: (url: string) => void;
  onPick?: (option: LinkOption) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, options: g.options.filter((o) => o.label.toLowerCase().includes(q) || o.url.toLowerCase().includes(q)) }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);

  const set = (v: string) => {
    setValue(v);
    onValueChange?.(v);
  };

  const external = isExternalUrl(value);
  const invalid = value !== "" && !external && !/^\/(?!\/)/.test(value);
  const known = groups.flatMap((g) => g.options).find((o) => o.url === value);

  return (
    <div ref={rootRef} className="relative space-y-1">
      <div className="flex gap-2">
        <input
          name={name}
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder="พิมพ์ลิงก์ (https://...) หรือกด “เลือกปลายทาง”"
          autoComplete="off"
          className="min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3"
          aria-invalid={invalid}
        />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-brand bg-brand-soft px-4 text-sm font-semibold text-brand hover:bg-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 13a5 5 0 0 0 7.1 0l2.8-2.8a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1 0l-2.8 2.8a5 5 0 0 0 7.1 7.1l1.1-1.1" />
          </svg>
          เลือกปลายทาง
        </button>
      </div>

      <p className="min-h-5 text-xs">
        {invalid ? (
          <span className="text-red-600">ลิงก์ต้องขึ้นต้นด้วย / (ในเว็บ) หรือ https:// (ภายนอก)</span>
        ) : external ? (
          <span className="text-amber-700">ลิงก์ภายนอก — จะเปิดในแท็บใหม่</span>
        ) : value ? (
          <span className="text-green-700">ลิงก์ภายในเว็บ{known ? `: ${known.label}` : ""}</span>
        ) : (
          <span className="text-neutral-500">เว้นว่างได้ ถ้าไม่ต้องการให้กดแล้วไปไหน</span>
        )}
      </p>

      {open && (
        <div id={panelId} className="absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-2xl" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาหน้า คอร์ส หรือสื่อ..."
            aria-label="ค้นหาปลายทาง"
            className="mb-2 min-h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
          />
          {filtered.length === 0 && <p className="p-3 text-sm text-neutral-500">ไม่พบรายการ — พิมพ์ลิงก์เองได้ในช่องด้านบน</p>}
          {filtered.map((g) => (
            <div key={g.label} className="mb-1">
              <p className="px-2 py-1 text-xs font-semibold text-neutral-500">{g.label} ({g.options.length})</p>
              {g.options.map((o) => (
                <button
                  key={o.url}
                  type="button"
                  onClick={() => {
                    set(o.url);
                    onPick?.(o);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-brand-soft ${o.url === value ? "bg-brand-soft font-semibold text-brand" : ""}`}
                >
                  <span className="truncate">{o.label}</span>
                  <span className="shrink-0 text-xs text-neutral-400">{o.url}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
