"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import Glyph from "@/components/glyph";
import { Spinner } from "@/components/icons";
import SitePageBody from "@/components/site-page-body";
import { BLOCK_KINDS, BLOCK_LABEL, MAX_TEXT, cleanBlock, youtubeVideoId } from "@/lib/course/blocks";
import { MAX_BLOCKS_PER_LESSON } from "@/lib/course/access";
import { DEFAULT_WATCH_PERCENT, type BlockKind } from "@/lib/course/rules";
import { isParsed, parseMediaLink } from "@/lib/embed";
import { addBlock, deleteBlock, moveBlock, searchMediaForCourse, updateBlock, updateLesson } from "../../../actions";

export type LessonValues = { id: string; title: string; summary: string; unlockRule: "OPEN" | "AFTER_PREVIOUS"; required: boolean; sectionTitle: string };
export type BlockValues = { id: string; kind: BlockKind; label: string; url: string; mediaId: string; mediaTitle: string; text: string; quizId: string; required: boolean; minPercent: number | null };
type QuizOption = { id: string; title: string };

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";
const iconBtn = "flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30";
const blank = (kind: BlockKind): BlockValues => ({ id: "", kind, label: "", url: "", mediaId: "", mediaTitle: "", text: "", quizId: "", required: kind === "VIDEO" || kind === "QUIZ", minPercent: null });

// ------------------------------------------------------------------------------------------------ lesson settings
export function LessonSettings({ courseId, lesson, sections }: { courseId: string; lesson: LessonValues; sections: string[] }) {
  const router = useRouter();
  const [v, setV] = useState(lesson);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    start(async () => {
      const r = await updateLesson(courseId, lesson.id, { title: v.title, summary: v.summary, unlockRule: v.unlockRule, required: v.required, sectionTitle: v.sectionTitle });
      if ("error" in r && r.error) return setError(r.error);
      setMsg("บันทึกแล้ว");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">ตั้งค่าบทเรียน</h2>
      <label className="block space-y-1"><span className="text-sm font-medium">ชื่อบทเรียน *</span><input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required maxLength={120} className={input} /></label>
      <label className="block space-y-1"><span className="text-sm font-medium">สรุปสั้นๆ (ไม่บังคับ)</span><textarea value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} rows={2} maxLength={1000} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-medium">เมื่อไหร่ผู้เรียนเปิดบทนี้ได้</span>
          <select value={v.unlockRule} onChange={(e) => setV({ ...v, unlockRule: e.target.value as LessonValues["unlockRule"] })} className={input}>
            <option value="OPEN">เปิดได้เลย (ไม่ต้องเรียนบทก่อนหน้า)</option>
            <option value="AFTER_PREVIOUS">เปิดเมื่อเรียนจบบทก่อนหน้า</option>
          </select>
        </label>
        <label className="block space-y-1"><span className="text-sm font-medium">หมวด / ตอน (ไม่บังคับ)</span>
          <input value={v.sectionTitle} onChange={(e) => setV({ ...v, sectionTitle: e.target.value })} list="course-sections" maxLength={100} placeholder="เช่น ตอนที่ 1 พื้นฐาน" className={input} />
          <datalist id="course-sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={v.required} onChange={(e) => setV({ ...v, required: e.target.checked })} className="h-5 w-5" /><span>เป็นบทบังคับ (นับเป็นเงื่อนไขจบคอร์ส)</span></label>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      {msg && <p role="status" className="text-sm font-medium text-green-700">{msg}</p>}
      <button disabled={pending} className="flex min-h-11 items-center gap-2 rounded-lg bg-brand px-6 font-semibold text-white disabled:opacity-60">{pending && <Spinner className="h-4 w-4" />}บันทึกการตั้งค่า</button>
    </form>
  );
}

// ------------------------------------------------------------------------------------------------ one content block
function MediaPicker({ value, title, onPick }: { value: string; title: string; onPick: (id: string, title: string) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ id: string; title: string; area: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      const r = await searchMediaForCourse(q);
      if (my === seq.current) { setRows(r); setBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-2">
      {value && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm"><strong>เลือกแล้ว:</strong> {title || value}</p>}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาสื่อในคลังสื่อ (ชื่อหรือแท็ก)" aria-label="ค้นหาสื่อในคลังสื่อ" className={input} />
      <ul className="max-h-56 space-y-1 overflow-y-auto" aria-busy={busy}>
        {rows.map((m) => (
          <li key={m.id}><button type="button" onClick={() => onPick(m.id, m.title)} className={`flex min-h-11 w-full flex-col justify-center rounded-lg border px-3 py-1.5 text-left ${m.id === value ? "border-brand bg-brand-soft" : "border-neutral-200 hover:bg-neutral-50"}`}><span className="truncate text-sm font-medium">{m.title}</span><span className="text-xs text-neutral-500">{m.area}</span></button></li>
        ))}
        {!busy && rows.length === 0 && <li className="px-1 text-sm text-neutral-500">ไม่พบสื่อที่เผยแพร่แล้วตามคำค้น</li>}
      </ul>
    </div>
  );
}

function BlockPreview({ b }: { b: BlockValues }) {
  if (b.kind === "VIDEO") {
    const id = youtubeVideoId(b.url) ?? (() => { const r = b.url ? parseMediaLink(b.url) : null; return r && isParsed(r) ? youtubeVideoId(r.url) : null; })();
    return id ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="ภาพตัวอย่างวิดีโอ" referrerPolicy="no-referrer" className="aspect-video w-full max-w-xs rounded-lg object-cover" />
    ) : null;
  }
  if (b.kind === "LINK" && b.url) {
    const r = parseMediaLink(b.url);
    return <p className={`text-sm ${isParsed(r) ? "text-green-700" : "text-red-600"}`}>{isParsed(r) ? `รู้จักลิงก์: ${r.provider}` : r.error}</p>;
  }
  if (b.kind === "TEXT" && b.text.trim()) return <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm"><SitePageBody body={b.text} /></div>;
  return null;
}

/** One block: shown as an editor card. `isNew` = not saved yet (the Save button creates it). */
function BlockCard({ courseId, lessonId, initial, quizzes, index, count, isNew, onDone }: { courseId: string; lessonId: string; initial: BlockValues; quizzes: QuizOption[]; index: number; count: number; isNew: boolean; onDone: () => void }) {
  const router = useRouter();
  const [b, setB] = useState(initial);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const payload = () => ({ kind: b.kind, label: b.label, url: b.url, mediaId: b.mediaId || null, text: b.text, quizId: b.quizId || null, required: b.required, minPercent: b.kind === "VIDEO" ? b.minPercent : null });

  function save() {
    setError("");
    setMsg("");
    const check = cleanBlock(payload());
    if (!check.ok) return setError(check.error);
    start(async () => {
      const r = isNew ? await addBlock(courseId, lessonId, payload()) : await updateBlock(courseId, b.id, payload());
      if ("error" in r && r.error) return setError(r.error);
      if (isNew) onDone();
      else setMsg("บันทึกแล้ว");
      router.refresh();
    });
  }
  const run = (fn: () => Promise<{ error?: string } | object>) =>
    start(async () => {
      setError("");
      const r = await fn();
      if ("error" in r && r.error) return setError(r.error as string);
      router.refresh();
    });

  const requiredText: Record<BlockKind, string> = {
    VIDEO: "ต้องดูวิดีโอให้ถึงเปอร์เซ็นต์ที่กำหนดก่อนจบบท",
    LINK: "ต้องกด “ฉันเรียนบทนี้แล้ว” ก่อนจบบท",
    MEDIA: "ต้องกด “ฉันเรียนบทนี้แล้ว” ก่อนจบบท",
    TEXT: "ต้องกด “ฉันเรียนบทนี้แล้ว” ก่อนจบบท",
    QUIZ: "ต้องทำแบบทดสอบให้ผ่านก่อนจบบท",
  };

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{isNew ? "+" : index + 1}</span>{BLOCK_LABEL[b.kind]}</p>
        {!isNew ? (
          <div className="flex gap-1.5">
            <button type="button" aria-label="เลื่อนขึ้น" disabled={pending || index === 0} onClick={() => run(() => moveBlock(courseId, b.id, "up"))} className={iconBtn}><Glyph name="chevron-down" size={18} className="rotate-180" /></button>
            <button type="button" aria-label="เลื่อนลง" disabled={pending || index === count - 1} onClick={() => run(() => moveBlock(courseId, b.id, "down"))} className={iconBtn}><Glyph name="chevron-down" size={18} /></button>
            <button type="button" aria-label="ลบส่วนเนื้อหานี้" disabled={pending} onClick={() => { if (confirm("ลบส่วนเนื้อหานี้?")) run(() => deleteBlock(courseId, b.id)); }} className={`${iconBtn} border-red-200 text-red-600 hover:bg-red-50`}><Glyph name="x" size={18} /></button>
          </div>
        ) : <button type="button" onClick={onDone} className="min-h-10 rounded-lg border border-neutral-300 px-3 text-sm">ยกเลิก</button>}
      </div>

      <label className="block space-y-1"><span className="text-sm font-medium">หัวข้อส่วนนี้ (ไม่บังคับ)</span><input value={b.label} onChange={(e) => setB({ ...b, label: e.target.value })} maxLength={80} className={input} /></label>

      {(b.kind === "VIDEO" || b.kind === "LINK") && (
        <div className="space-y-2">
          <label className="block space-y-1"><span className="text-sm font-medium">{b.kind === "VIDEO" ? "ลิงก์วิดีโอ YouTube *" : "ลิงก์ *"}</span>
            <input value={b.url} onChange={(e) => setB({ ...b, url: e.target.value })} inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={b.kind === "VIDEO" ? "https://www.youtube.com/watch?v=…" : "https://drive.google.com/… หรือ Docs / Apps Script / Canva"} className={input} />
          </label>
          <BlockPreview b={b} />
          {b.kind === "VIDEO" && <p className="text-xs text-neutral-500">ใช้วิดีโอจากช่องของตัวเองหรือตั้งเป็น “ไม่แสดงในรายการ” จะไม่มีโฆษณาคั่น (ถ้าวิดีโอเปิดโฆษณา ผู้เรียนจะเห็นโฆษณาและตัวนับอาจคลาดเคลื่อนเล็กน้อย)</p>}
          {b.kind === "LINK" && <p className="text-xs text-neutral-500">ลิงก์เหล่านี้ระบบวัดการดูไม่ได้ จึงใช้ปุ่ม “ฉันเรียนบทนี้แล้ว” แทน · เว็บบางแห่งไม่ยอมให้ฝัง ระบบจะแสดงเป็นปุ่มเปิดในแท็บใหม่</p>}
        </div>
      )}
      {b.kind === "MEDIA" && <MediaPicker value={b.mediaId} title={b.mediaTitle} onPick={(id, t) => setB({ ...b, mediaId: id, mediaTitle: t })} />}
      {b.kind === "TEXT" && (
        <div className="space-y-2">
          <textarea value={b.text} onChange={(e) => setB({ ...b, text: e.target.value })} rows={8} maxLength={MAX_TEXT} aria-label="ข้อความอธิบาย" className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm leading-relaxed" />
          <p className="text-xs text-neutral-500">เว้นบรรทัด = ย่อหน้าใหม่ · <code>## หัวข้อ</code> · <code>- รายการ</code> · <code>[ข้อความ](https://…)</code> · ไม่รองรับ HTML</p>
          <BlockPreview b={b} />
        </div>
      )}
      {b.kind === "QUIZ" && (
        <label className="block space-y-1"><span className="text-sm font-medium">เลือกแบบทดสอบ *</span>
          <select value={b.quizId} onChange={(e) => setB({ ...b, quizId: e.target.value })} className={input}>
            <option value="">เลือกแบบทดสอบ</option>
            {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
          {quizzes.length === 0 && <span className="block text-xs text-amber-700">ยังไม่มีแบบทดสอบ — สร้างที่แท็บ “แบบทดสอบ” ก่อน</span>}
        </label>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-neutral-50 p-3">
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={b.required} onChange={(e) => setB({ ...b, required: e.target.checked })} className="h-5 w-5" />{requiredText[b.kind]}</label>
        {b.kind === "VIDEO" && b.required && (
          <label className="flex items-center gap-2 text-sm">ดูให้ถึง
            <input type="number" min={10} max={100} value={b.minPercent ?? DEFAULT_WATCH_PERCENT} onChange={(e) => setB({ ...b, minPercent: e.target.value ? Number(e.target.value) : null })} className="min-h-10 w-20 rounded-lg border border-neutral-300 px-2 text-center" aria-label="เปอร์เซ็นต์ที่ต้องดู" />%
          </label>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      {msg && <p role="status" className="text-sm font-medium text-green-700">{msg}</p>}
      <button type="button" onClick={save} disabled={pending} className="flex min-h-11 items-center gap-2 rounded-lg bg-brand px-6 font-semibold text-white disabled:opacity-60">{pending && <Spinner className="h-4 w-4" />}{isNew ? "เพิ่มส่วนเนื้อหานี้" : "บันทึกส่วนนี้"}</button>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ the list of blocks
export function BlocksEditor({ courseId, lessonId, blocks, quizzes }: { courseId: string; lessonId: string; blocks: BlockValues[]; quizzes: QuizOption[] }) {
  const [adding, setAdding] = useState<BlockKind | null>(null);
  const full = blocks.length >= MAX_BLOCKS_PER_LESSON;

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">เนื้อหาในบทเรียน</h2>
      {blocks.length === 0 && !adding && <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-neutral-600">ยังไม่มีเนื้อหา — เลือกชนิดที่ต้องการเพิ่มด้านล่าง</p>}
      {blocks.map((b, i) => <BlockCard key={`${b.id}-${JSON.stringify([b.url, b.text, b.required, b.minPercent, b.label, b.quizId, b.mediaId])}`} courseId={courseId} lessonId={lessonId} initial={b} quizzes={quizzes} index={i} count={blocks.length} isNew={false} onDone={() => {}} />)}
      {adding && <BlockCard key={`new-${adding}`} courseId={courseId} lessonId={lessonId} initial={blank(adding)} quizzes={quizzes} index={blocks.length} count={blocks.length + 1} isNew onDone={() => setAdding(null)} />}
      {!adding && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium">เพิ่มเนื้อหา {full && <span className="text-red-600">(ครบ {MAX_BLOCKS_PER_LESSON} ส่วนแล้ว)</span>}</p>
          <div className="flex flex-wrap gap-2">
            {BLOCK_KINDS.map((k) => <button key={k} type="button" disabled={full} onClick={() => setAdding(k)} className="min-h-11 rounded-full border border-brand/40 bg-brand-soft px-4 text-sm font-semibold text-brand disabled:opacity-40">+ {BLOCK_LABEL[k]}</button>)}
          </div>
        </div>
      )}
    </section>
  );
}
