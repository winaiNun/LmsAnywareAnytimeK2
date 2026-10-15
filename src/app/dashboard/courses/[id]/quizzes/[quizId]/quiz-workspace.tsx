"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Glyph from "@/components/glyph";
import { MAX_QUESTIONS_PER_QUIZ } from "@/lib/course/access";
import { Spinner } from "@/components/icons";
import QuizPlayer from "@/components/quiz/quiz-player";
import type { PublicQuestion } from "@/lib/course/quiz/present";
import { PRESETS, QUIZ_CHECKLIST, SETTING_HELP, type Preset } from "@/lib/course/quiz/help";
import { TYPE_LABEL, parseQuestion, type QuestionType } from "@/lib/course/quiz/schemas";
import { quizSettingWarnings, suggestTimeLimit } from "@/lib/course/quiz/timing";
import { deleteQuestion, moveQuestion, previewQuiz, updateQuiz } from "../../../actions";
import QuestionEditor, { TypePicker, type QuestionValues } from "./question-editor";
import QuizImport from "./quiz-import";

export type QuizValues = { id: string; title: string; passPercent: number; maxAttempts: number | null; timeLimitMin: number | null; shuffleQuestions: boolean; shuffleChoices: boolean; showAnswers: "NEVER" | "AFTER_PASS" | "EACH_ATTEMPT" };

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";
const iconBtn = "flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30";
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const Hint = ({ children }: { children: React.ReactNode }) => <span className="block text-xs leading-snug text-neutral-500">{children}</span>;

export type QuizQuestionInfo = { type: QuestionType; config: unknown; explanation: string };

export function QuizSettings({ courseId, quiz, questions }: { courseId: string; quiz: QuizValues; questions: QuizQuestionInfo[] }) {
  const router = useRouter();
  const [v, setV] = useState({ ...quiz, maxAttempts: quiz.maxAttempts === null ? "" : String(quiz.maxAttempts), timeLimitMin: quiz.timeLimitMin === null ? "" : String(quiz.timeLimitMin), passPercent: String(quiz.passPercent) });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const suggested = suggestTimeLimit(questions);
  const toNum = (x: string) => (x.trim() === "" || Number.isNaN(Number(x)) ? null : Number(x));
  const warnings = quizSettingWarnings(
    { passPercent: toNum(v.passPercent) ?? 0, maxAttempts: toNum(v.maxAttempts), timeLimitMin: toNum(v.timeLimitMin), showAnswers: v.showAnswers, shuffleQuestions: v.shuffleQuestions, shuffleChoices: v.shuffleChoices },
    { questionCount: questions.length, suggestedMin: suggested, withoutExplanation: questions.filter((q) => !q.explanation.trim()).length },
  );

  // fills the form only; nothing is saved until the author presses save
  function applyPreset(p: Preset) {
    setMsg("");
    setV({ ...v, passPercent: String(p.values.passPercent), maxAttempts: p.values.maxAttempts === null ? "" : String(p.values.maxAttempts), timeLimitMin: p.values.timeLimit === "suggested" && suggested > 0 ? String(suggested) : "", showAnswers: p.values.showAnswers, shuffleQuestions: p.values.shuffleQuestions, shuffleChoices: p.values.shuffleChoices });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    start(async () => {
      const r = await updateQuiz(courseId, quiz.id, { title: v.title, passPercent: Number(v.passPercent), maxAttempts: num(v.maxAttempts), timeLimitMin: num(v.timeLimitMin), shuffleQuestions: v.shuffleQuestions, shuffleChoices: v.shuffleChoices, showAnswers: v.showAnswers });
      if ("error" in r && r.error) return setError(r.error);
      setMsg("บันทึกแล้ว");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">ตั้งค่าแบบทดสอบ</h2>
        <Link href="/dashboard/courses/guide" className="text-sm text-brand hover:underline">คู่มือผู้สร้างคอร์ส →</Link>
      </div>
      <div className="space-y-2 rounded-xl bg-brand-soft/50 p-3">
        <p className="text-sm font-medium">เริ่มจากชุดค่าแนะนำ <span className="font-normal text-neutral-500">(เติมค่าในฟอร์ม แล้วปรับเองได้ ยังไม่บันทึกจนกว่าจะกดปุ่มบันทึก)</span></p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => applyPreset(p)} className="rounded-lg border border-brand/30 bg-white p-2.5 text-left hover:bg-brand-soft">
              <span className="block text-sm font-semibold text-brand">{p.label}</span>
              <span className="block text-xs leading-snug text-neutral-500">{p.note}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="block space-y-1"><span className="text-sm font-medium">ชื่อแบบทดสอบ *</span><input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required maxLength={120} className={input} /><Hint>{SETTING_HELP.title}</Hint></label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1"><span className="text-sm font-medium">เกณฑ์ผ่าน (%)</span><input value={v.passPercent} onChange={(e) => setV({ ...v, passPercent: e.target.value })} inputMode="numeric" className={input} /><Hint>{SETTING_HELP.passPercent}</Hint></label>
        <label className="block space-y-1"><span className="text-sm font-medium">ทำได้กี่ครั้ง</span><input value={v.maxAttempts} onChange={(e) => setV({ ...v, maxAttempts: e.target.value })} inputMode="numeric" placeholder="ว่าง = ไม่จำกัด" className={input} /><Hint>{SETTING_HELP.maxAttempts}</Hint></label>
        <label className="block space-y-1"><span className="text-sm font-medium">เวลาที่ให้ (นาที)</span><input value={v.timeLimitMin} onChange={(e) => setV({ ...v, timeLimitMin: e.target.value })} inputMode="numeric" placeholder="ว่าง = ไม่จำกัด" className={input} /><Hint>{SETTING_HELP.timeLimitMin}</Hint></label>
      </div>
      {suggested > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50 p-3 text-sm">
          <p className="min-w-0 flex-1 basis-60">เวลาที่แนะนำสำหรับ {questions.length} ข้อนี้ ≈ <strong>{suggested} นาที</strong> <span className="text-neutral-500">(คำนวณจากชนิดของคำถามและเผื่อเวลาเพิ่ม 50%)</span></p>
          <button type="button" onClick={() => setV({ ...v, timeLimitMin: String(suggested) })} disabled={v.timeLimitMin === String(suggested)} className="min-h-10 rounded-lg border border-brand px-4 text-sm font-medium text-brand disabled:opacity-40">ใช้ค่าที่แนะนำ</button>
        </div>
      )}
      <label className="block space-y-1"><span className="text-sm font-medium">การแสดงเฉลยให้ผู้เรียน</span>
        <select value={v.showAnswers} onChange={(e) => setV({ ...v, showAnswers: e.target.value as QuizValues["showAnswers"] })} className={input}>
          <option value="AFTER_PASS">แสดงเฉลยหลังผ่านแบบทดสอบ</option>
          <option value="EACH_ATTEMPT">แสดงเฉลยทุกครั้งหลังส่ง</option>
          <option value="NEVER">ไม่แสดงเฉลย (บอกแค่คะแนน)</option>
        </select>
        <Hint>{SETTING_HELP.showAnswers}</Hint>
      </label>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <div><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={v.shuffleQuestions} onChange={(e) => setV({ ...v, shuffleQuestions: e.target.checked })} className="h-5 w-5" />สลับลำดับคำถามแต่ละคน</label><Hint>{SETTING_HELP.shuffleQuestions}</Hint></div>
        <div><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={v.shuffleChoices} onChange={(e) => setV({ ...v, shuffleChoices: e.target.checked })} className="h-5 w-5" />สลับลำดับตัวเลือก</label><Hint>{SETTING_HELP.shuffleChoices}</Hint></div>
      </div>
      {warnings.length > 0 && (
        <ul aria-label="ข้อแนะนำการตั้งค่า" className="space-y-2">
          {warnings.map((w, i) => (
            <li key={i} className={`rounded-lg px-3 py-2 text-sm leading-snug ${w.level === "warn" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"}`}>
              <strong>{w.level === "warn" ? "ควรทบทวน: " : "ข้อแนะนำ: "}</strong>{w.text}
            </li>
          ))}
        </ul>
      )}
      <details className="rounded-lg border border-neutral-200 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-brand">เช็กลิสต์ก่อนส่งตรวจ</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-600">{QUIZ_CHECKLIST.map((c) => <li key={c}>{c}</li>)}</ul>
      </details>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      {msg && <p role="status" className="text-sm font-medium text-green-700">{msg}</p>}
      <button disabled={pending} className="flex min-h-11 items-center gap-2 rounded-lg bg-brand px-6 font-semibold text-white disabled:opacity-60">{pending && <Spinner className="h-4 w-4" />}บันทึกการตั้งค่า</button>
    </form>
  );
}

export function Questions({ courseId, quizId, questions }: { courseId: string; quizId: string; questions: QuestionValues[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // question id, or "new"
  const [newType, setNewType] = useState<QuestionType | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ error?: string } | object>) => start(async () => { setError(""); const r = await fn(); if ("error" in r && r.error) setError(r.error as string); else router.refresh(); });
  const total = questions.reduce((n, q) => n + q.points, 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">คำถาม ({questions.length} ข้อ · รวม {total} คะแนน)</h2></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {questions.length === 0 && !newType && <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-neutral-600">ยังไม่มีคำถาม — เลือกชนิดคำถามด้านล่าง</p>}
      <ol className="space-y-3">
        {questions.map((q, i) => {
          const ok = parseQuestion(q.type, q.config, q.answerKey).ok;
          if (editing === q.id) return <li key={q.id}><QuestionEditor courseId={courseId} quizId={quizId} type={q.type} initial={q} onClose={() => setEditing(null)} /></li>;
          return (
            <li key={q.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="line-clamp-2 font-medium leading-snug">{q.prompt}</p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500"><span>{TYPE_LABEL[q.type]}</span><span>{q.points} คะแนน</span>{!ok && <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">เฉลยยังไม่ครบ</span>}</p>
              </div>
              <div className="flex w-full shrink-0 justify-end gap-1.5 sm:w-auto">
                <button type="button" aria-label="เลื่อนขึ้น" disabled={pending || i === 0} onClick={() => act(() => moveQuestion(courseId, q.id, "up"))} className={iconBtn}><Glyph name="chevron-down" size={18} className="rotate-180" /></button>
                <button type="button" aria-label="เลื่อนลง" disabled={pending || i === questions.length - 1} onClick={() => act(() => moveQuestion(courseId, q.id, "down"))} className={iconBtn}><Glyph name="chevron-down" size={18} /></button>
                <button type="button" onClick={() => { setNewType(null); setEditing(q.id); }} className="min-h-10 rounded-lg border border-neutral-300 px-3 text-sm hover:bg-neutral-50">แก้ไข</button>
                <button type="button" aria-label="ลบคำถาม" disabled={pending} onClick={() => { if (confirm("ลบคำถามข้อนี้?")) act(() => deleteQuestion(courseId, q.id)); }} className={`${iconBtn} border-red-200 text-red-600 hover:bg-red-50`}><Glyph name="x" size={18} /></button>
              </div>
            </li>
          );
        })}
      </ol>
      <QuizImport courseId={courseId} quizId={quizId} room={Math.max(0, MAX_QUESTIONS_PER_QUIZ - questions.length)} />
      {newType ? <QuestionEditor key={newType} courseId={courseId} quizId={quizId} type={newType} initial={null} onClose={() => setNewType(null)} /> : <TypePicker onPick={(t) => { setEditing(null); setNewType(t); }} />}
    </section>
  );
}

/** "Try it": answer the real questions (in a random order) and see the result with the key; nothing is saved. */
export function TryIt({ courseId, quizId, questions, timeLimitMin }: { courseId: string; quizId: string; questions: PublicQuestion[]; timeLimitMin: number | null }) {
  const router = useRouter();
  const [timed, setTimed] = useState(false);
  const [round, setRound] = useState(0);
  if (questions.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">ลองทำแบบทดสอบ (ไม่บันทึกผล)</h2>
      <p className="text-sm text-neutral-500">ลองทำเหมือนผู้เรียน เพื่อเช็กว่าเฉลยถูกและคำถามเข้าใจง่าย — ตรงนี้เห็นเฉลยทุกครั้ง</p>
      {timeLimitMin !== null && (
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={timed} onChange={(e) => { setTimed(e.target.checked); setRound((n) => n + 1); }} className="h-5 w-5" />
          ลองแบบจับเวลา {timeLimitMin} นาที (เหมือนที่ผู้เรียนจะเจอ ใช้ลองดูว่าเวลาพอหรือไม่)
        </label>
      )}
      <QuizPlayer key={`${timed}-${round}`} questions={questions} secondsLeft={timed && timeLimitMin !== null ? timeLimitMin * 60 : null} totalSeconds={timed && timeLimitMin !== null ? timeLimitMin * 60 : null} onSubmit={(answers) => previewQuiz(courseId, quizId, answers)} onRetry={() => { setRound((n) => n + 1); router.refresh(); }} retryLabel="ลองใหม่ (สลับลำดับใหม่)" />
    </section>
  );
}
