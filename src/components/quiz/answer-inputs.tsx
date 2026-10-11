"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- an answer is a small per-type JSON value (see grade.ts) */
import { Fragment } from "react";
import Glyph from "@/components/glyph";
import type { PublicQuestion } from "@/lib/course/quiz/present";

type Opt = { id: string; text: string };
type Props = { q: PublicQuestion; value: any; onChange: (v: any) => void; disabled?: boolean };

const field = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 disabled:bg-neutral-100";
const choice = (on: boolean) => `flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-left transition ${on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300 bg-white hover:bg-neutral-50"}`;

/** The starting answer of a question (ORDER starts as the order shown, so leaving it alone still counts). */
export function initialAnswer(q: PublicQuestion): any {
  if (q.type === "ORDER") return { order: (q.config.items as Opt[]).map((i) => i.id) };
  return {};
}

/** One answer control per question type, all built from plain selects, buttons and inputs so they work with a thumb and a screen reader. */
export default function AnswerInput({ q, value, onChange, disabled }: Props) {
  const v = value ?? {};
  switch (q.type) {
    case "SINGLE":
      return (
        <div role="radiogroup" aria-label="เลือกคำตอบ" className="space-y-2">
          {(q.config.choices as Opt[]).map((c) => (
            <label key={c.id} className={choice(v.choiceId === c.id)}>
              <input type="radio" name={`q-${q.id}`} checked={v.choiceId === c.id} onChange={() => onChange({ choiceId: c.id })} disabled={disabled} className="sr-only" />
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${v.choiceId === c.id ? "border-brand bg-brand text-white" : "border-neutral-400"}`}>{v.choiceId === c.id && <Glyph name="check" size={12} strokeWidth={3} />}</span>
              <span>{c.text}</span>
            </label>
          ))}
        </div>
      );
    case "MULTI": {
      const picked: string[] = v.choiceIds ?? [];
      const toggle = (id: string) => onChange({ choiceIds: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });
      return (
        <div role="group" aria-label="เลือกได้หลายข้อ" className="space-y-2">
          <p className="text-xs text-neutral-500">เลือกได้หลายข้อ</p>
          {(q.config.choices as Opt[]).map((c) => (
            <label key={c.id} className={choice(picked.includes(c.id))}>
              <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} disabled={disabled} className="sr-only" />
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${picked.includes(c.id) ? "border-brand bg-brand text-white" : "border-neutral-400"}`}>{picked.includes(c.id) && <Glyph name="check" size={12} strokeWidth={3} />}</span>
              <span>{c.text}</span>
            </label>
          ))}
        </div>
      );
    }
    case "TRUEFALSE":
      return (
        <div role="radiogroup" aria-label="ถูกหรือผิด" className="grid grid-cols-2 gap-3">
          {([[true, "ถูก"], [false, "ผิด"]] as const).map(([val, label]) => (
            <label key={label} className={`${choice(v.value === val)} justify-center text-lg`}>
              <input type="radio" name={`q-${q.id}`} checked={v.value === val} onChange={() => onChange({ value: val })} disabled={disabled} className="sr-only" />{label}
            </label>
          ))}
        </div>
      );
    case "SHORT":
      return <input value={v.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} disabled={disabled} maxLength={200} placeholder={q.config.placeholder || "พิมพ์คำตอบ"} aria-label="คำตอบ" autoComplete="off" className={field} />;
    case "NUMBER":
      return (
        <div className="flex items-center gap-2">
          <input value={v.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} disabled={disabled} maxLength={30} inputMode="decimal" placeholder="ตัวเลขคำตอบ" aria-label="คำตอบที่เป็นตัวเลข" autoComplete="off" className={`${field} max-w-xs`} />
          {q.config.unit && <span className="text-neutral-600">{q.config.unit}</span>}
        </div>
      );
    case "MATCH": {
      const pairs: Record<string, string> = v.pairs ?? {};
      const usedBy = new Set(Object.values(pairs));
      return (
        <ul className="space-y-3">
          {(q.config.left as Opt[]).map((l) => (
            <li key={l.id} className="grid gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[1fr_1fr] sm:items-center">
              <span className="font-medium">{l.text}</span>
              <select value={pairs[l.id] ?? ""} onChange={(e) => { const next = { ...pairs }; if (e.target.value) next[l.id] = e.target.value; else delete next[l.id]; onChange({ pairs: next }); }} disabled={disabled} aria-label={`จับคู่กับ ${l.text}`} className={field}>
                <option value="">เลือกคู่ที่ตรงกัน</option>
                {(q.config.right as Opt[]).map((r) => <option key={r.id} value={r.id}>{r.text}{usedBy.has(r.id) && pairs[l.id] !== r.id ? " (ใช้แล้ว)" : ""}</option>)}
              </select>
            </li>
          ))}
        </ul>
      );
    }
    case "ORDER": {
      const order: string[] = v.order ?? (q.config.items as Opt[]).map((i) => i.id);
      const text = new Map((q.config.items as Opt[]).map((i) => [i.id, i.text]));
      const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= order.length) return; const next = [...order]; [next[i], next[j]] = [next[j], next[i]]; onChange({ order: next }); };
      return (
        <div>
          <p className="mb-2 text-xs text-neutral-500">กดลูกศรเพื่อเลื่อนข้อความให้อยู่ในลำดับที่ถูกต้อง</p>
          <ol className="space-y-2">
            {order.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white p-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>
                <span className="min-w-0 flex-1 break-words">{text.get(id)}</span>
                <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`เลื่อน ${text.get(id)} ขึ้น`} className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-300 disabled:opacity-30"><Glyph name="chevron-down" size={18} className="rotate-180" /></button>
                <button type="button" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} aria-label={`เลื่อน ${text.get(id)} ลง`} className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-300 disabled:opacity-30"><Glyph name="chevron-down" size={18} /></button>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    case "CATEGORIZE": {
      const map: Record<string, string> = v.map ?? {};
      return (
        <ul className="space-y-3">
          {(q.config.items as Opt[]).map((it) => (
            <li key={it.id} className="grid gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[1fr_1fr] sm:items-center">
              <span className="font-medium">{it.text}</span>
              <select value={map[it.id] ?? ""} onChange={(e) => { const next = { ...map }; if (e.target.value) next[it.id] = e.target.value; else delete next[it.id]; onChange({ map: next }); }} disabled={disabled} aria-label={`หมวดของ ${it.text}`} className={field}>
                <option value="">เลือกหมวด</option>
                {(q.config.categories as Opt[]).map((c) => <option key={c.id} value={c.id}>{c.text}</option>)}
              </select>
            </li>
          ))}
        </ul>
      );
    }
    case "CLOZE": {
      const blanks: Record<string, string> = v.blanks ?? {};
      const set = (id: string, val: string) => onChange({ blanks: { ...blanks, [id]: val } });
      const defs = new Map<string, { id: string; mode: "type" | "choose"; options?: Opt[] }>((q.config.blanks as any[]).map((b) => [b.id, b]));
      const parts = String(q.config.text).split(/(\{\{\s*[A-Za-z0-9_-]{1,40}\s*\}\})/g);
      return (
        <p className="leading-[2.6] text-lg">
          {parts.map((part, i) => {
            const m = /^\{\{\s*([A-Za-z0-9_-]{1,40})\s*\}\}$/.exec(part);
            if (!m) return <Fragment key={i}>{part}</Fragment>;
            const b = defs.get(m[1]);
            if (!b) return <Fragment key={i}>…</Fragment>;
            return b.mode === "choose" ? (
              <select key={i} value={blanks[b.id] ?? ""} onChange={(e) => set(b.id, e.target.value)} disabled={disabled} aria-label={`ช่องว่าง ${b.id}`} className="mx-1 min-h-11 rounded-lg border border-neutral-300 bg-white px-2 text-base">
                <option value="">เลือก…</option>
                {(b.options ?? []).map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
              </select>
            ) : (
              <input key={i} value={blanks[b.id] ?? ""} onChange={(e) => set(b.id, e.target.value)} disabled={disabled} maxLength={120} aria-label={`ช่องว่าง ${b.id}`} autoComplete="off" className="mx-1 min-h-11 w-40 rounded-lg border border-neutral-300 bg-white px-2 text-base" />
            );
          })}
        </p>
      );
    }
    default:
      return null;
  }
}
