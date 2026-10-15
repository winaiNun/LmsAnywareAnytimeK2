"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Glyph from "@/components/glyph";
import { Spinner } from "@/components/icons";
import type { PublicQuestion } from "@/lib/course/quiz/present";
import type { QuizOutcome } from "@/lib/course/quiz/reveal";
import { TYPE_LABEL } from "@/lib/course/quiz/schemas";
import { warnLevel, type WarnLevel } from "@/lib/course/quiz/timing";
import AnswerInput, { initialAnswer } from "./answer-inputs";

const STATUS: Record<string, [string, string]> = {
  correct: ["ถูกต้อง", "bg-green-50 text-green-700"],
  partial: ["ถูกบางส่วน", "bg-amber-50 text-amber-800"],
  wrong: ["ไม่ถูกต้อง", "bg-red-50 text-red-700"],
  blank: ["ยังไม่ได้ตอบ", "bg-neutral-100 text-neutral-600"],
};

/**
 * Shows the questions of one attempt, collects the answers and hands them to `onSubmit` (the server grades them).
 * Shared by the learners' quiz and the author's "try it" preview. `secondsLeft` (counted by the server, so a wrong
 * device clock cannot change it) shows a countdown, warns before the end and hands in automatically when it runs out.
 */
export default function QuizPlayer({ questions, onSubmit, onRetry, secondsLeft, totalSeconds, retryLabel = "ทำอีกครั้ง", canRetry = true }: {
  questions: PublicQuestion[];
  onSubmit: (answers: Record<string, unknown>) => Promise<{ outcome: QuizOutcome } | { error: string }>;
  onRetry?: () => void;
  secondsLeft?: number | null;
  /** the whole time limit, used to decide whether short quizzes need an "almost over" warning (defaults to secondsLeft) */
  totalSeconds?: number | null;
  retryLabel?: string;
  canRetry?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => Object.fromEntries(questions.map((q) => [q.id, initialAnswer(q)])));
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const [error, setError] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const lastLevel = useRef<WarnLevel>("none");
  const [pending, start] = useTransition();
  const done = useRef(false);

  function submit() {
    if (done.current) return;
    done.current = true;
    setError("");
    start(async () => {
      const r = await onSubmit(answers);
      if ("error" in r) { done.current = false; setError(r.error); return; }
      setOutcome(r.outcome);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // The end is fixed once, on the monotonic clock (performance.now), from the seconds the server said were left.
  useEffect(() => {
    if (secondsLeft == null) return;
    const end = performance.now() + secondsLeft * 1000;
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - performance.now()) / 1000));
      setLeft(s);
      const level = warnLevel(s, totalSeconds ?? secondsLeft);
      if (level !== lastLevel.current) {
        lastLevel.current = level;
        if (level === "5min") setAnnounce("เหลือเวลาอีก 5 นาที");
        if (level === "1min") setAnnounce("เหลือเวลาไม่ถึง 1 นาที");
      }
      if (s === 0) submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick); // a phone that slept catches up at once
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [secondsLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const level = left === null || secondsLeft == null ? "none" : warnLevel(left, totalSeconds ?? secondsLeft);
  const answered = (q: PublicQuestion) => JSON.stringify(answers[q.id]) !== JSON.stringify(initialAnswer(q)) || q.type === "ORDER";

  return (
    <div className="space-y-5">
      {outcome && (
        <div role="status" className={`rounded-2xl p-5 ${outcome.passed ? "bg-green-50" : "bg-amber-50"}`}>
          <p className={`flex items-center gap-2 text-lg font-bold ${outcome.passed ? "text-green-800" : "text-amber-900"}`}><Glyph name={outcome.passed ? "check" : "help-circle"} size={22} strokeWidth={2.2} />{outcome.passed ? "ผ่าน" : "ยังไม่ผ่าน"} — {outcome.percent}%</p>
          <p className="mt-1 text-sm text-neutral-700">ได้ {outcome.score} จาก {outcome.maxScore} คะแนน · เกณฑ์ผ่าน {outcome.passPercent}%</p>
          {onRetry && canRetry && <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-neutral-400 bg-white px-5 font-semibold">{retryLabel}</button>}
        </div>
      )}
      {left !== null && !outcome && (
        <>
          <p
            role="timer"
            aria-live="off"
            className={`sticky top-16 z-10 rounded-xl px-4 py-2 text-center font-semibold shadow-sm ${level === "1min" ? "animate-pulse bg-red-600 text-white motion-reduce:animate-none" : level === "5min" ? "bg-amber-100 text-amber-900" : "bg-white text-neutral-800"}`}
          >
            เวลาที่เหลือ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            {level !== "none" && <span className="ml-2 text-sm font-medium">· ใกล้หมดเวลา</span>}
          </p>
          <p role="status" aria-live="polite" className="sr-only">{announce}</p>
        </>
      )}

      <ol className="space-y-4">
        {questions.map((q, i) => {
          const res = outcome?.perQuestion[q.id];
          return (
            <li key={q.id} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm text-neutral-500"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>{TYPE_LABEL[q.type]} · {q.points} คะแนน</p>
                {res && <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${STATUS[res.status][1]}`}>{STATUS[res.status][0]} ({res.points}/{res.max})</span>}
              </div>
              <p className="whitespace-pre-line text-lg font-medium leading-relaxed">{q.prompt}</p>
              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.imageUrl} alt="ภาพประกอบคำถาม" referrerPolicy="no-referrer" loading="lazy" className="max-h-72 w-auto max-w-full rounded-xl border border-neutral-200" />
              )}
              <AnswerInput q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} disabled={!!outcome || pending} />
              {res?.reveal && (
                <div className="space-y-1 rounded-xl bg-neutral-50 p-3 text-sm">
                  <p><strong>เฉลย:</strong> {res.reveal.answer}</p>
                  {res.reveal.explanation && <p className="whitespace-pre-line text-neutral-600">{res.reveal.explanation}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!outcome && (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <button type="button" onClick={submit} disabled={pending} className="flex min-h-12 items-center gap-2 rounded-xl bg-brand px-8 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">{pending && <Spinner className="h-4 w-4" />}ส่งคำตอบ</button>
          <p className="text-sm text-neutral-500">ตอบแล้ว {questions.filter(answered).length} จาก {questions.length} ข้อ</p>
          {error && <p role="alert" className="w-full text-sm font-medium text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
