"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  THAI_MONTHS, THAI_WEEKDAYS_SHORT, bangkokParts, formatThaiDate, formatThaiInput, fromBangkokParts, isSameBangkokDay, monthGrid, parseInstant,
  parseThaiDateInput, toBE,
} from "@/lib/thai-date";

type Props = {
  /** Form field name. The submitted value is an ISO instant (UTC, e.g. 2026-10-08T07:30:00.000Z) or "". */
  name: string;
  label: string;
  defaultValue?: string | null;
  /** Also ask for a time (24-hour, Bangkok). */
  withTime?: boolean;
  /** Time used when a day is picked without one (default 00:00). */
  defaultTime?: { hour: number; minute: number };
  required?: boolean;
  onChange?: (value: Date | null) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Date (and optional time) field that shows and accepts พ.ศ. The user can type 08/10/2569 (or 2026, or
 * 69) or use the calendar; what is submitted is always a real instant, never a พ.ศ. number.
 */
export default function ThaiDateField({ name, label, defaultValue, withTime = false, defaultTime = { hour: 0, minute: 0 }, required, onChange }: Props) {
  const initial = useMemo(() => parseInstant(defaultValue), [defaultValue]);
  const [value, setValue] = useState<Date | null>(initial);
  const [text, setText] = useState(formatThaiInput(initial, withTime));
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const base = bangkokParts(value ?? new Date());
  const [view, setView] = useState({ year: base.year, month: base.month });
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function commit(next: Date | null) {
    setValue(next);
    setText(formatThaiInput(next, withTime));
    setError("");
    onChange?.(next);
  }

  /** Typed text → value (on blur / Enter). */
  function applyText() {
    const raw = text.trim();
    if (!raw) {
      if (required) setError("กรุณาเลือกวันที่");
      else commit(null);
      return;
    }
    const parsed = parseThaiDateInput(raw);
    const current = value ? bangkokParts(value) : defaultTime;
    const date = parsed
      ? fromBangkokParts({ year: parsed.year, month: parsed.month, day: parsed.day, hour: parsed.hasTime ? parsed.hour : withTime ? current.hour : 0, minute: parsed.hasTime ? parsed.minute : withTime ? current.minute : 0 })
      : null;
    if (!date) {
      setError("วันที่ไม่ถูกต้อง — พิมพ์เป็น วว/ดด/ปปปป เช่น 08/10/2569 (พ.ศ.)");
      return;
    }
    commit(date);
    const p = bangkokParts(date);
    setView({ year: p.year, month: p.month });
  }

  function pickDay(year: number, month: number, day: number) {
    const t = value ? bangkokParts(value) : defaultTime;
    const next = fromBangkokParts({ year, month, day, hour: withTime ? t.hour : 0, minute: withTime ? t.minute : 0 });
    if (next) commit(next);
    if (!withTime) setOpen(false);
  }

  function setTime(hour: number, minute: number) {
    const p = value ? bangkokParts(value) : bangkokParts(new Date());
    const next = fromBangkokParts({ year: p.year, month: p.month, day: p.day, hour, minute });
    if (next) commit(next);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const index = v.year * 12 + (v.month - 1) + delta;
      return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
    });
  }

  const today = new Date();
  const todayParts = bangkokParts(today);
  const grid = monthGrid(view.year, view.month);
  const selected = value ? bangkokParts(value) : null;
  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    for (let y = todayParts.year - 5; y <= todayParts.year + 10; y++) years.add(y);
    years.add(view.year);
    if (selected) years.add(selected.year);
    return [...years].sort((a, b) => a - b);
  }, [todayParts.year, view.year, selected]);

  const field = "min-h-11 rounded-lg border bg-white px-3";

  return (
    <div ref={rootRef} className="relative block space-y-1">
      <label htmlFor={id} className="text-sm font-medium">{label}{required && " *"}</label>
      <input type="hidden" name={name} value={value ? value.toISOString() : ""} />
      <div className="flex gap-2">
        <input
          id={id}
          value={text}
          inputMode="numeric"
          autoComplete="off"
          placeholder={withTime ? "วว/ดด/ปปปป ชม:นน (พ.ศ.)" : "วว/ดด/ปปปป (พ.ศ.)"}
          onChange={(e) => { setText(e.target.value); setError(""); }}
          onBlur={applyText}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyText(); } }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={`${field} w-full min-w-0 ${error ? "border-red-500" : "border-neutral-300"}`}
        />
        <button
          type="button"
          aria-label={`เปิดปฏิทิน ${label}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white text-brand hover:bg-brand-soft"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5.5 4.5h13a1.5 1.5 0 0 1 1.5 1.5v12.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V6a1.5 1.5 0 0 1 1.5-1.5zM4 9.5h16M8 2.8v3.4M16 2.8v3.4" />
          </svg>
        </button>
        {value && !required && (
          <button type="button" aria-label={`ล้าง ${label}`} onClick={() => commit(null)} className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        )}
      </div>

      <p id={`${id}-err`} role={error ? "alert" : undefined} className="min-h-4 text-xs">
        {error ? <span className="text-red-600">{error}</span> : value ? <span className="text-neutral-500">{formatThaiDate(value, { style: "long", weekday: true, time: withTime })}</span> : null}
      </p>

      {open && (
        <div role="dialog" aria-label={`ปฏิทิน ${label}`} className="absolute left-0 z-30 mt-1 w-[19.5rem] max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white p-3 shadow-2xl" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <div className="mb-2 flex items-center gap-1">
            <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => shiftMonth(-1)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-neutral-100">‹</button>
            <select aria-label="เดือน" value={view.month} onChange={(e) => setView({ ...view, month: +e.target.value })} className="min-h-10 flex-1 rounded-lg border border-neutral-200 bg-white px-2 text-sm">
              {THAI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select aria-label="ปี พ.ศ." value={view.year} onChange={(e) => setView({ ...view, year: +e.target.value })} className="min-h-10 w-24 rounded-lg border border-neutral-200 bg-white px-2 text-sm">
              {yearOptions.map((y) => <option key={y} value={y}>พ.ศ. {toBE(y)}</option>)}
            </select>
            <button type="button" aria-label="เดือนถัดไป" onClick={() => shiftMonth(1)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-neutral-100">›</button>
          </div>

          <div className="grid grid-cols-7 text-center text-xs text-neutral-500" aria-hidden>
            {THAI_WEEKDAYS_SHORT.map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((c) => {
              const isSel = !!selected && selected.year === c.year && selected.month === c.month && selected.day === c.day;
              const isToday = todayParts.year === c.year && todayParts.month === c.month && todayParts.day === c.day;
              return (
                <button
                  key={`${c.year}-${c.month}-${c.day}`}
                  type="button"
                  aria-label={`${c.day} ${THAI_MONTHS[c.month - 1]} ${toBE(c.year)}`}
                  aria-pressed={isSel}
                  onClick={() => pickDay(c.year, c.month, c.day)}
                  className={`flex h-10 items-center justify-center rounded-lg text-sm tabular-nums ${isSel ? "bg-brand font-semibold text-white" : c.inMonth ? "hover:bg-brand-soft" : "text-neutral-300 hover:bg-neutral-50"} ${isToday && !isSel ? "ring-1 ring-brand" : ""}`}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          {withTime && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-neutral-600">เวลา</span>
              <select aria-label="ชั่วโมง" value={selected?.hour ?? defaultTime.hour} onChange={(e) => setTime(+e.target.value, selected?.minute ?? defaultTime.minute)} className="min-h-10 rounded-lg border border-neutral-200 bg-white px-2">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad(h)}</option>)}
              </select>
              <span>:</span>
              <select aria-label="นาที" value={selected?.minute ?? defaultTime.minute} onChange={(e) => setTime(selected?.hour ?? defaultTime.hour, +e.target.value)} className="min-h-10 rounded-lg border border-neutral-200 bg-white px-2">
                {Array.from({ length: 60 }, (_, m) => <option key={m} value={m}>{pad(m)}</option>)}
              </select>
              <span className="text-neutral-600">น.</span>
            </div>
          )}

          <div className="mt-3 flex justify-between gap-2">
            <button type="button" onClick={() => { const p = bangkokParts(today); setView({ year: p.year, month: p.month }); if (!value || !isSameBangkokDay(value, today)) pickDay(p.year, p.month, p.day); }} className="min-h-10 rounded-lg border border-neutral-300 px-3 text-sm">วันนี้</button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg bg-brand px-5 text-sm font-semibold text-white">ตกลง</button>
          </div>
        </div>
      )}
    </div>
  );
}
