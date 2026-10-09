"use client";

import { useEffect } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** On-screen numeric keypad (phone style) with 6 dots and a delete key. Also accepts a physical keyboard. */
export default function PinPad({ value, onChange, disabled, length = 6 }: { value: string; onChange: (v: string) => void; disabled?: boolean; length?: number }) {
  const add = (d: string) => !disabled && value.length < length && onChange(value + d);
  const del = () => !disabled && onChange(value.slice(0, -1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select")) return; // typing in the username field
      if (/^\d$/.test(e.key)) add(e.key);
      else if (e.key === "Backspace") del();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const key = "flex h-16 w-16 select-none items-center justify-center rounded-full border border-white/30 bg-white/10 text-2xl font-semibold text-white transition active:scale-95 active:bg-white/30 disabled:opacity-50 sm:hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white";

  return (
    <div className="mt-1" role="group" aria-label="แป้นกรอก PIN 6 หลัก">
      <div className="mb-5 flex justify-center gap-3" role="status" aria-label={`กรอกแล้ว ${value.length} จาก ${length} หลัก`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 border-white transition ${i < value.length ? "scale-110 bg-white" : "bg-transparent"}`} />
        ))}
      </div>
      <div className="mx-auto grid w-fit grid-cols-3 gap-x-5 gap-y-3">
        {KEYS.map((k) => (
          <button key={k} type="button" disabled={disabled} onClick={() => add(k)} className={key} style={{ touchAction: "manipulation" }}>{k}</button>
        ))}
        <span aria-hidden />
        <button type="button" disabled={disabled} onClick={() => add("0")} className={key} style={{ touchAction: "manipulation" }}>0</button>
        <button type="button" disabled={disabled || !value} onClick={del} aria-label="ลบหลักล่าสุด" className={`${key} !border-transparent !bg-transparent`} style={{ touchAction: "manipulation" }}>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM17 9.5l-5 5M12 9.5l5 5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
