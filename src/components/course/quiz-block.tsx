"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startQuiz, submitQuiz } from "@/app/courses/learn-actions";
import Glyph from "@/components/glyph";
import { Spinner } from "@/components/icons";
import QuizPlayer from "@/components/quiz/quiz-player";
import type { QuizStatus } from "@/lib/course/course-learn";
import type { PublicQuestion } from "@/lib/course/quiz/present";

type Info = { id: string; title: string; passPercent: number; maxAttempts: number | null; timeLimitMin: number | null; questionCount: number };

/** A quiz inside a lesson: shows the rules and the learner's record, starts an attempt, and grades it on the server. */
export default function QuizBlock({ courseId, quiz, status, required }: { courseId: string; quiz: Info; status: QuizStatus; required: boolean }) {
  const router = useRouter();
  const [run, setRun] = useState<{ attemptId: string; questions: PublicQuestion[]; secondsLeft: number | null } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const left = quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - status.attempts);

  function begin() {
    setError("");
    start(async () => {
      const r = await startQuiz(quiz.id);
      if ("error" in r) return setError(r.error);
      setRun({ attemptId: r.attemptId, questions: r.questions, secondsLeft: r.secondsLeft });
    });
  }

  if (run) {
    return (
      <section className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5" aria-label={`แบบทดสอบ ${quiz.title}`}>
        <h3 className="font-semibold">{quiz.title}</h3>
        <QuizPlayer
          key={run.attemptId}
          questions={run.questions}
          secondsLeft={run.secondsLeft}
          totalSeconds={quiz.timeLimitMin ? quiz.timeLimitMin * 60 : null}
          onSubmit={async (answers) => {
            const r = await submitQuiz(courseId, run.attemptId, answers);
            if ("error" in r) return { error: r.error };
            router.refresh();
            return { outcome: r.outcome };
          }}
          canRetry={left === null || left > 1}
          onRetry={() => { setRun(null); begin(); }}
          retryLabel="ทำอีกครั้ง"
        />
        <button type="button" onClick={() => { setRun(null); router.refresh(); }} className="min-h-11 rounded-lg border border-neutral-300 bg-white px-5 text-sm">ปิดแบบทดสอบ</button>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5" aria-label={`แบบทดสอบ ${quiz.title}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><Glyph name="clipboard-check" size={18} className="text-brand" />{quiz.title}</h3>
        {status.passed ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700"><Glyph name="check" size={14} strokeWidth={2.6} />ผ่านแล้ว</span> : required ? <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">คำถามปลดล็อกบทถัดไป</span> : null}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-600">
        <li>{quiz.questionCount} ข้อ</li>
        <li>เกณฑ์ผ่าน {quiz.passPercent}%</li>
        {quiz.timeLimitMin && <li>จำกัดเวลา {quiz.timeLimitMin} นาที</li>}
        <li>{quiz.maxAttempts === null ? "ทำได้ไม่จำกัดครั้ง" : `ทำได้ ${quiz.maxAttempts} ครั้ง (เหลือ ${left} ครั้ง)`}</li>
        {status.best !== null && <li>คะแนนสูงสุดของคุณ <strong className="text-neutral-900">{status.best}%</strong></li>}
      </ul>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      {left === 0 && !status.open ? (
        <p className="text-sm text-neutral-500">ทำครบจำนวนครั้งแล้ว</p>
      ) : (
        <button type="button" onClick={begin} disabled={pending} className="flex min-h-12 items-center gap-2 rounded-xl bg-brand px-7 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">{pending && <Spinner className="h-4 w-4" />}{status.open ? "ทำต่อ" : status.attempts > 0 ? "ทำอีกครั้ง" : "เริ่มทำแบบทดสอบ"}</button>
      )}
      {status.open?.secondsLeft != null && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">คุณมีแบบทดสอบที่ทำค้างอยู่ เวลาเดินอยู่ เหลืออีกประมาณ {Math.max(1, Math.ceil(status.open.secondsLeft / 60))} นาที — กด “ทำต่อ” เพื่อทำให้เสร็จ</p>
      )}
      {quiz.timeLimitMin && !status.open && (
        <p className="text-xs leading-relaxed text-neutral-500">
          เวลาเริ่มนับเมื่อกด “เริ่มทำแบบทดสอบ” และ<strong>เดินต่อแม้ปิดหน้านี้หรืออินเทอร์เน็ตหลุด</strong> ถ้าหมดเวลาโดยยังไม่ส่ง จะนับเป็นหนึ่งครั้งที่ทำแล้ว และคำตอบที่ยังไม่ส่งจะไม่ถูกนับ ควรเตรียมให้พร้อมก่อนเริ่ม
        </p>
      )}
    </section>
  );
}
