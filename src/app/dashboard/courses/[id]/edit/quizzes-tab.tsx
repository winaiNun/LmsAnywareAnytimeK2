"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createQuiz, deleteQuiz } from "../../actions";

export type QuizRow = { id: string; title: string; questionCount: number; passPercent: number; usedInLessons: number };

/** The quizzes of a course: create, open the question editor, delete (only while no lesson uses it). */
export default function QuizzesTab({ courseId, quizzes }: { courseId: string; quizzes: QuizRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function create(unlock: boolean) {
    setError("");
    if (!title.trim()) return setError("กรุณากรอกชื่อแบบทดสอบ");
    start(async () => {
      const r = await createQuiz(courseId, title, unlock);
      if ("error" in r && r.error) return setError(r.error);
      if ("id" in r) router.push(`/dashboard/courses/${courseId}/quizzes/${r.id}`);
    });
  }

  return (
    <section className="space-y-4">
      <p className="rounded-xl bg-brand-soft/60 p-3 text-sm text-neutral-700">แบบทดสอบ/แบบฝึกหัดสร้างที่นี่ก่อน แล้วไปใส่ในบทเรียนด้วยส่วนเนื้อหาชนิด “แบบทดสอบ” ระบบตรวจคะแนนให้เองทั้งหมด (ปรนัย ถูก/ผิด เติมคำ ตัวเลข จับคู่ เรียงลำดับ จัดหมวดหมู่ เติมช่องว่างในประโยค)</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {quizzes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-600">ยังไม่มีแบบทดสอบ</div>
      ) : (
        <ul className="space-y-2">
          {quizzes.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/courses/${courseId}/quizzes/${q.id}`} className="block truncate font-semibold hover:text-brand">{q.title}</Link>
                <p className="text-xs text-neutral-500">{q.questionCount} ข้อ · เกณฑ์ผ่าน {q.passPercent}% · {q.usedInLessons > 0 ? `ใช้ในบทเรียน ${q.usedInLessons} แห่ง` : "ยังไม่ได้ใส่ในบทเรียน"}</p>
              </div>
              <Link href={`/dashboard/courses/${courseId}/quizzes/${q.id}`} className="flex min-h-10 items-center rounded-lg border border-neutral-300 px-3 text-sm hover:bg-neutral-50">แก้ไข</Link>
              <button
                type="button"
                disabled={pending || q.usedInLessons > 0}
                title={q.usedInLessons > 0 ? "เอาออกจากบทเรียนก่อนจึงจะลบได้" : "ลบ"}
                onClick={() => { if (confirm(`ลบแบบทดสอบ “${q.title}” พร้อมคำถามทั้งหมด?`)) start(async () => { const r = await deleteQuiz(courseId, q.id); if ("error" in r && r.error) setError(r.error); else router.refresh(); }); }}
                className="min-h-10 rounded-lg border border-red-200 px-3 text-sm text-red-600 disabled:opacity-30"
              >ลบ</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); create(false); }} className="flex flex-wrap gap-2 rounded-2xl bg-white p-3 shadow-sm">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="ชื่อแบบทดสอบใหม่ เช่น แบบฝึกหัดท้ายบทที่ 1" aria-label="ชื่อแบบทดสอบใหม่" className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3" />
        <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white disabled:opacity-60">+ สร้างแบบทดสอบ</button>
        <button type="button" disabled={pending} onClick={() => create(true)} className="min-h-11 rounded-lg border border-brand px-5 font-semibold text-brand disabled:opacity-60">+ สร้างคำถามปลดล็อกบทถัดไป</button>
        <p className="w-full text-xs text-neutral-500">“คำถามปลดล็อก” คือชุดคำถามปรนัยสั้นๆ ที่ผู้เรียนต้องตอบถูกทั้งหมดจึงจะเรียนบทถัดไปได้ ทำซ้ำได้ไม่จำกัด ใช้เช็กว่าได้ดูวิดีโอหรืออ่านเอกสารแล้ว (ไม่ใช้ก็ได้ — ผู้เรียนกดปุ่ม “ฉันเรียนบทนี้แล้ว” แทน)</p>
      </form>
    </section>
  );
}
