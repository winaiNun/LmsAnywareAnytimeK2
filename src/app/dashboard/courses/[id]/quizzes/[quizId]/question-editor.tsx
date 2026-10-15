"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Glyph from "@/components/glyph";
import { Spinner } from "@/components/icons";
import { emptyState, stateFromQuestion, stateToQuestion, syncBlanks, type EditorState } from "@/lib/course/quiz/editor-model";
import { TYPE_HELP } from "@/lib/course/quiz/help";
import { QUESTION_TYPES, TYPE_LABEL, parseQuestion, type QuestionType } from "@/lib/course/quiz/schemas";
import { saveQuestion } from "../../../actions";

export type QuestionValues = { id: string; type: QuestionType; points: number; prompt: string; imageUrl: string; explanation: string; config: unknown; answerKey: unknown };

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";
const area = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2";
const small = "min-h-10 rounded-lg border border-neutral-300 px-3 text-sm hover:bg-neutral-50 disabled:opacity-40";

/** Pick a type of question to add. */
export function TypePicker({ onPick }: { onPick: (t: QuestionType) => void }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="mb-1 text-sm font-medium">เพิ่มคำถาม — เลือกชนิด</p>
      <p className="mb-3 text-xs text-neutral-500">ไม่แน่ใจว่าใช้ชนิดไหน? ดูคำอธิบายและตัวอย่างในแต่ละการ์ด หรืออ่าน <Link href="/dashboard/courses/guide" className="text-brand underline">คู่มือผู้สร้างคอร์ส</Link></p>
      <div className="grid gap-2 sm:grid-cols-2">
        {QUESTION_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => onPick(t)} className="rounded-xl border border-brand/30 bg-brand-soft/40 p-3 text-left transition hover:border-brand hover:bg-brand-soft">
            <span className="block text-sm font-semibold text-brand">+ {TYPE_LABEL[t]}</span>
            <span className="mt-0.5 block text-xs leading-snug text-neutral-700">{TYPE_HELP[t].summary}</span>
            <span className="mt-1 block text-xs leading-snug text-neutral-500">เหมาะกับ: {TYPE_HELP[t].goodFor}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ editors per type
function Choices({ list, onChange, min, label, correct, onCorrect, multi }: { list: { id: string; text: string }[]; onChange: (l: { id: string; text: string }[]) => void; min: number; label: string; correct: string[]; onCorrect: (ids: string[]) => void; multi: boolean }) {
  const next = () => { let n = list.length + 1; while (list.some((x) => x.id === `c${n}`)) n++; return `c${n}`; };
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label} <span className="font-normal text-neutral-500">(ติ๊กข้อที่ถูก)</span></p>
      {list.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2">
          <input type={multi ? "checkbox" : "radio"} name="correct" checked={correct.includes(c.id)} onChange={() => onCorrect(multi ? (correct.includes(c.id) ? correct.filter((x) => x !== c.id) : [...correct, c.id]) : [c.id])} aria-label={`ข้อ ${i + 1} เป็นคำตอบที่ถูก`} className="h-5 w-5 shrink-0" />
          <input value={c.text} onChange={(e) => onChange(list.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} maxLength={300} placeholder={`ตัวเลือกที่ ${i + 1}`} aria-label={`ตัวเลือกที่ ${i + 1}`} className={input} />
          <button type="button" disabled={list.length <= min} onClick={() => { onChange(list.filter((x) => x.id !== c.id)); onCorrect(correct.filter((x) => x !== c.id)); }} aria-label={`ลบตัวเลือกที่ ${i + 1}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 disabled:opacity-30"><Glyph name="x" size={16} /></button>
        </div>
      ))}
      <button type="button" disabled={list.length >= 10} onClick={() => onChange([...list, { id: next(), text: "" }])} className={small}>+ เพิ่มตัวเลือก</button>
    </div>
  );
}

function TypeEditor({ s, set }: { s: EditorState; set: (s: EditorState) => void }) {
  switch (s.type) {
    case "SINGLE":
      return <Choices list={s.choices} onChange={(choices) => set({ ...s, choices })} min={2} label="ตัวเลือก" correct={[s.correct]} onCorrect={(ids) => set({ ...s, correct: ids[0] ?? "" })} multi={false} />;
    case "MULTI":
      return (
        <div className="space-y-3">
          <Choices list={s.choices} onChange={(choices) => set({ ...s, choices })} min={2} label="ตัวเลือก" correct={s.correct} onCorrect={(correct) => set({ ...s, correct })} multi />
          <label className="block space-y-1"><span className="text-sm font-medium">การให้คะแนน</span>
            <select value={s.scoring} onChange={(e) => set({ ...s, scoring: e.target.value as "all" | "partial" })} className={input}>
              <option value="all">ต้องถูกครบทุกข้อและไม่เลือกผิดเลย จึงได้คะแนนเต็ม</option>
              <option value="partial">ให้คะแนนบางส่วน (เลือกถูกได้คะแนน เลือกผิดหักคะแนน)</option>
            </select>
          </label>
        </div>
      );
    case "TRUEFALSE":
      return (
        <fieldset className="space-y-2"><legend className="text-sm font-medium">ข้อความนี้ถูกหรือผิด *</legend>
          <div className="flex gap-3">{([[true, "ถูก"], [false, "ผิด"]] as const).map(([v, l]) => <label key={l} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-6 ${s.value === v ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}><input type="radio" name="tf" checked={s.value === v} onChange={() => set({ ...s, value: v })} className="sr-only" />{l}</label>)}</div>
        </fieldset>
      );
    case "SHORT":
      return (
        <div className="space-y-3">
          <label className="block space-y-1"><span className="text-sm font-medium">คำตอบที่ยอมรับว่าถูก (บรรทัดละคำตอบ) *</span><textarea value={s.accepted} onChange={(e) => set({ ...s, accepted: e.target.value })} rows={3} placeholder={"กรุงเทพมหานคร\nกรุงเทพ"} className={area} /></label>
          <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={s.ignoreSpaces} onChange={(e) => set({ ...s, ignoreSpaces: e.target.checked })} className="h-5 w-5" />ไม่สนใจช่องว่าง (“กรุง เทพ” = “กรุงเทพ”)</label>
          <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={s.caseSensitive} onChange={(e) => set({ ...s, caseSensitive: e.target.checked })} className="h-5 w-5" />แยกตัวพิมพ์เล็ก-ใหญ่ (ภาษาอังกฤษ)</label>
          <p className="text-xs text-neutral-500">เลขไทยกับเลขอารบิกถือว่าเท่ากัน (๕ = 5) · ระบบตัดช่องว่างหัวท้ายให้เอง</p>
        </div>
      );
    case "NUMBER":
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1"><span className="text-sm font-medium">คำตอบที่ถูก *</span><input value={s.value} onChange={(e) => set({ ...s, value: e.target.value })} inputMode="decimal" className={input} /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">คลาดเคลื่อนได้ ±</span><input value={s.tolerance} onChange={(e) => set({ ...s, tolerance: e.target.value })} inputMode="decimal" className={input} /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">หน่วย (ไม่บังคับ)</span><input value={s.unit} onChange={(e) => set({ ...s, unit: e.target.value })} maxLength={20} placeholder="เช่น บาท, เมตร" className={input} /></label>
        </div>
      );
    case "MATCH":
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium">คู่ที่ถูกต้อง (ซ้าย ↔ ขวา) <span className="font-normal text-neutral-500">ผู้เรียนจะเห็นฝั่งขวาสลับลำดับ</span></p>
          {s.rows.map((r, i) => (
            <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input value={r.left} onChange={(e) => set({ ...s, rows: s.rows.map((x) => (x.id === r.id ? { ...x, left: e.target.value } : x)) })} maxLength={300} placeholder={`ซ้าย ${i + 1}`} aria-label={`ซ้าย ${i + 1}`} className={input} />
              <input value={r.right} onChange={(e) => set({ ...s, rows: s.rows.map((x) => (x.id === r.id ? { ...x, right: e.target.value } : x)) })} maxLength={300} placeholder={`ขวา ${i + 1}`} aria-label={`ขวา ${i + 1}`} className={input} />
              <button type="button" disabled={s.rows.length <= 2} onClick={() => set({ ...s, rows: s.rows.filter((x) => x.id !== r.id) })} aria-label={`ลบคู่ที่ ${i + 1}`} className="flex h-11 w-10 items-center justify-center rounded-lg border border-red-200 text-red-600 disabled:opacity-30"><Glyph name="x" size={16} /></button>
            </div>
          ))}
          <button type="button" disabled={s.rows.length >= 10} onClick={() => set({ ...s, rows: [...s.rows, { id: `p${s.rows.length + 1}-${Date.now() % 1000}`, left: "", right: "" }] })} className={small}>+ เพิ่มคู่</button>
          <label className="block space-y-1"><span className="text-sm font-medium">ตัวลวงฝั่งขวา (ไม่บังคับ บรรทัดละข้อ)</span><textarea value={s.distractors} onChange={(e) => set({ ...s, distractors: e.target.value })} rows={2} className={area} /></label>
        </div>
      );
    case "ORDER":
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium">เรียงตามลำดับที่ถูกต้อง (บนสุด = ข้อแรก) <span className="font-normal text-neutral-500">ผู้เรียนจะเห็นสลับลำดับ</span></p>
          {s.items.map((it, i) => (
            <div key={it.id} className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>
              <input value={it.text} onChange={(e) => set({ ...s, items: s.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)) })} maxLength={300} aria-label={`ข้อที่ ${i + 1}`} className={input} />
              <button type="button" disabled={i === 0} onClick={() => { const n = [...s.items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set({ ...s, items: n }); }} aria-label="เลื่อนขึ้น" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-300 disabled:opacity-30"><Glyph name="chevron-down" size={16} className="rotate-180" /></button>
              <button type="button" disabled={i === s.items.length - 1} onClick={() => { const n = [...s.items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set({ ...s, items: n }); }} aria-label="เลื่อนลง" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-300 disabled:opacity-30"><Glyph name="chevron-down" size={16} /></button>
              <button type="button" disabled={s.items.length <= 2} onClick={() => set({ ...s, items: s.items.filter((x) => x.id !== it.id) })} aria-label="ลบ" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 disabled:opacity-30"><Glyph name="x" size={16} /></button>
            </div>
          ))}
          <button type="button" disabled={s.items.length >= 10} onClick={() => set({ ...s, items: [...s.items, { id: `o${s.items.length + 1}-${Date.now() % 1000}`, text: "" }] })} className={small}>+ เพิ่มข้อ</button>
        </div>
      );
    case "CATEGORIZE":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">หมวดหมู่ (2–6 หมวด)</p>
            {s.categories.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <input value={c.text} onChange={(e) => set({ ...s, categories: s.categories.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })} maxLength={300} placeholder={`หมวดที่ ${i + 1}`} aria-label={`หมวดที่ ${i + 1}`} className={input} />
                <button type="button" disabled={s.categories.length <= 2} onClick={() => set({ ...s, categories: s.categories.filter((x) => x.id !== c.id), items: s.items.map((it) => (it.categoryId === c.id ? { ...it, categoryId: "" } : it)) })} aria-label={`ลบหมวดที่ ${i + 1}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 disabled:opacity-30"><Glyph name="x" size={16} /></button>
              </div>
            ))}
            <button type="button" disabled={s.categories.length >= 6} onClick={() => set({ ...s, categories: [...s.categories, { id: `k${s.categories.length + 1}-${Date.now() % 1000}`, text: "" }] })} className={small}>+ เพิ่มหมวด</button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">รายการที่ต้องจัดหมวด และหมวดที่ถูกต้อง</p>
            {s.items.map((it, i) => (
              <div key={it.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input value={it.text} onChange={(e) => set({ ...s, items: s.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)) })} maxLength={300} placeholder={`รายการที่ ${i + 1}`} aria-label={`รายการที่ ${i + 1}`} className={input} />
                <select value={it.categoryId} onChange={(e) => set({ ...s, items: s.items.map((x) => (x.id === it.id ? { ...x, categoryId: e.target.value } : x)) })} aria-label={`หมวดที่ถูกของรายการที่ ${i + 1}`} className={input}>
                  <option value="">เลือกหมวดที่ถูก</option>
                  {s.categories.map((c, ci) => <option key={c.id} value={c.id}>{c.text || `หมวดที่ ${ci + 1}`}</option>)}
                </select>
                <button type="button" disabled={s.items.length <= 2} onClick={() => set({ ...s, items: s.items.filter((x) => x.id !== it.id) })} aria-label={`ลบรายการที่ ${i + 1}`} className="flex h-11 w-10 items-center justify-center rounded-lg border border-red-200 text-red-600 disabled:opacity-30"><Glyph name="x" size={16} /></button>
              </div>
            ))}
            <button type="button" disabled={s.items.length >= 16} onClick={() => set({ ...s, items: [...s.items, { id: `i${s.items.length + 1}-${Date.now() % 1000}`, text: "", categoryId: "" }] })} className={small}>+ เพิ่มรายการ</button>
          </div>
        </div>
      );
    case "CLOZE":
      return (
        <div className="space-y-3">
          <label className="block space-y-1"><span className="text-sm font-medium">ประโยค — พิมพ์ {"{{1}}"} {"{{2}}"} ... ตรงที่จะเว้นเป็นช่องว่าง *</span>
            <textarea value={s.text} onChange={(e) => set(syncBlanks({ ...s, text: e.target.value }))} rows={3} placeholder="เมืองหลวงของไทยคือ {{1}} อยู่ในภาค {{2}}" className={area} />
          </label>
          <button type="button" onClick={() => { const n = Math.max(0, ...s.blanks.map((b) => Number(b.id) || 0)) + 1; set(syncBlanks({ ...s, text: `${s.text}${s.text && !s.text.endsWith(" ") ? " " : ""}{{${n}}}` })); }} className={small}>+ แทรกช่องว่างต่อท้ายประโยค</button>
          {s.blanks.map((b) => (
            <div key={b.id} className="space-y-2 rounded-xl border border-neutral-200 p-3">
              <p className="text-sm font-semibold">ช่องว่าง {`{{${b.id}}}`}</p>
              <select value={b.mode} onChange={(e) => set({ ...s, blanks: s.blanks.map((x) => (x.id === b.id ? { ...x, mode: e.target.value as "type" | "choose" } : x)) })} aria-label={`รูปแบบของช่องว่าง ${b.id}`} className={input}>
                <option value="type">ให้ผู้เรียนพิมพ์คำตอบ</option>
                <option value="choose">ให้ผู้เรียนเลือกจากรายการ</option>
              </select>
              {b.mode === "type" ? (
                <label className="block space-y-1"><span className="text-sm">คำตอบที่ยอมรับ (บรรทัดละคำตอบ)</span><textarea value={b.accepted} onChange={(e) => set({ ...s, blanks: s.blanks.map((x) => (x.id === b.id ? { ...x, accepted: e.target.value } : x)) })} rows={2} className={area} /></label>
              ) : (
                <div className="space-y-2">
                  <label className="block space-y-1"><span className="text-sm">ตัวเลือก (บรรทัดละข้อ อย่างน้อย 2 ข้อ)</span><textarea value={b.options} onChange={(e) => set({ ...s, blanks: s.blanks.map((x) => (x.id === b.id ? { ...x, options: e.target.value } : x)) })} rows={3} className={area} /></label>
                  <label className="block space-y-1"><span className="text-sm">ข้อที่ถูกคือข้อที่</span>
                    <select value={b.correct} onChange={(e) => set({ ...s, blanks: s.blanks.map((x) => (x.id === b.id ? { ...x, correct: Number(e.target.value) } : x)) })} className={input}>
                      {b.options.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).map((o, i) => <option key={i} value={i}>{i + 1}. {o}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      );
  }
}

// ------------------------------------------------------------------------------------------------ the whole question
export default function QuestionEditor({ courseId, quizId, type, initial, onClose }: { courseId: string; quizId: string; type: QuestionType; initial: QuestionValues | null; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<EditorState>(() => (initial ? stateFromQuestion(initial.type, initial.config, initial.answerKey) : emptyState(type)));
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [points, setPoints] = useState(String(initial?.points ?? 1));
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function save() {
    setError("");
    const q = stateToQuestion(state);
    const check = parseQuestion(state.type, q.config, q.answerKey);
    if (!prompt.trim()) return setError("กรุณาพิมพ์คำถาม");
    if (!check.ok) return setError(check.error);
    const pts = Number(points);
    start(async () => {
      const r = await saveQuestion(courseId, quizId, initial?.id ?? null, { type: state.type, points: pts, prompt, imageUrl, explanation, config: q.config, answerKey: q.answerKey });
      if ("error" in r && r.error) return setError(r.error);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-brand/40 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{initial ? "แก้ไขคำถาม" : "คำถามใหม่"} — {TYPE_LABEL[state.type]}</h3>
        <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-neutral-300 px-3 text-sm">ปิด</button>
      </div>
      <details className="rounded-lg bg-brand-soft/50 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-brand">เคล็ดลับสำหรับ “{TYPE_LABEL[state.type]}”</summary>
        <p className="mt-2 text-neutral-700"><strong>ตัวอย่าง:</strong> {TYPE_HELP[state.type].example}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-neutral-600">{TYPE_HELP[state.type].tips.map((t) => <li key={t}>{t}</li>)}</ul>
      </details>
      <label className="block space-y-1"><span className="text-sm font-medium">คำถาม *</span><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} maxLength={2000} className={area} /></label>
      <label className="block space-y-1"><span className="text-sm font-medium">ลิงก์รูปประกอบคำถาม (ไม่บังคับ)</span><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} inputMode="url" autoCapitalize="none" placeholder="https://drive.google.com/file/d/…/view หรือที่อยู่รูป https://…" className={input} />
        <span className="block text-xs text-neutral-500">ใช้ลิงก์รูปจาก Google Drive (แชร์ “ทุกคนที่มีลิงก์”) ภาพกว้างไม่เกิน 1200 px ไฟล์ไม่เกิน 1 MB</span>
      </label>
      <TypeEditor s={state} set={setState} />
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <label className="block space-y-1"><span className="text-sm font-medium">คะแนนข้อนี้</span><input value={points} onChange={(e) => setPoints(e.target.value)} inputMode="numeric" className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">คำอธิบายเฉลย (ไม่บังคับ)</span><textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} maxLength={2000} className={area} placeholder="แสดงให้ผู้เรียนดูตามที่ตั้งค่า “การแสดงเฉลย” ของแบบทดสอบ" /></label>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={pending} className="flex min-h-11 items-center gap-2 rounded-lg bg-brand px-6 font-semibold text-white disabled:opacity-60">{pending && <Spinner className="h-4 w-4" />}บันทึกคำถาม</button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-neutral-300 px-5">ยกเลิก</button>
      </div>
    </div>
  );
}
