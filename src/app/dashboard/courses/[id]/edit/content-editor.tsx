"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Glyph from "@/components/glyph";
import { addLesson, deleteLesson, moveLesson } from "../../actions";

export type LessonRow = { id: string; title: string; sectionTitle: string | null; blockCount: number; required: boolean; unlockRule: "OPEN" | "AFTER_PREVIOUS" };

const iconBtn = "flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30";

/** The lesson outline: add, reorder, delete, and open a lesson to edit its content. Headings (sections) show where the section changes. */
export default function ContentEditor({ courseId, lessons }: { courseId: string; lessons: LessonRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ error?: string } | object>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if ("error" in r && r.error) setError(r.error as string);
      else router.refresh();
    });

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("กรุณากรอกชื่อบทเรียน");
    act(async () => {
      const r = await addLesson(courseId, title);
      if ("ok" in r && r.ok) { setTitle(""); router.push(`/dashboard/courses/${courseId}/lessons/${r.id}`); }
      return r;
    });
  }

  return (
    <section className="space-y-4">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-600">ยังไม่มีบทเรียน — เพิ่มบทแรกด้านล่าง</div>
      ) : (
        <ol className="space-y-2">
          {lessons.map((l, i) => (
            <li key={l.id}>
              {l.sectionTitle && l.sectionTitle !== lessons[i - 1]?.sectionTitle && <p className="px-1 pb-1 pt-3 text-sm font-semibold text-brand">{l.sectionTitle}</p>}
              <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/courses/${courseId}/lessons/${l.id}`} className="block truncate font-semibold hover:text-brand">{l.title}</Link>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                    <span>{l.blockCount === 0 ? "ยังไม่มีเนื้อหา" : `${l.blockCount} ส่วนเนื้อหา`}</span>
                    {l.unlockRule === "AFTER_PREVIOUS" && <span className="inline-flex items-center gap-1"><Glyph name="pin" size={12} />เปิดหลังจบบทก่อนหน้า</span>}
                    {!l.required && <span>ไม่บังคับ</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" aria-label="เลื่อนขึ้น" disabled={pending || i === 0} onClick={() => act(() => moveLesson(courseId, l.id, "up"))} className={iconBtn}><Glyph name="chevron-down" size={18} className="rotate-180" /></button>
                  <button type="button" aria-label="เลื่อนลง" disabled={pending || i === lessons.length - 1} onClick={() => act(() => moveLesson(courseId, l.id, "down"))} className={iconBtn}><Glyph name="chevron-down" size={18} /></button>
                  <Link href={`/dashboard/courses/${courseId}/lessons/${l.id}`} className="flex h-10 items-center rounded-lg border border-neutral-300 px-3 text-sm hover:bg-neutral-50">แก้ไข</Link>
                  <button type="button" aria-label={`ลบ ${l.title}`} disabled={pending} onClick={() => { if (confirm(`ลบบท “${l.title}” พร้อมเนื้อหาในบท?`)) act(() => deleteLesson(courseId, l.id)); }} className={`${iconBtn} border-red-200 text-red-600 hover:bg-red-50`}><Glyph name="x" size={18} /></button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={add} className="flex flex-wrap gap-2 rounded-2xl bg-white p-3 shadow-sm">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="ชื่อบทเรียนใหม่ เช่น บทที่ 1 ทำความรู้จัก…" aria-label="ชื่อบทเรียนใหม่" className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3" />
        <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white disabled:opacity-60">+ เพิ่มบทเรียน</button>
      </form>
    </section>
  );
}
