"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Spinner } from "@/components/icons";
import type { ImportRow } from "@/lib/course/quiz/import";
import { importQuestions, previewQuestionImport, type QuestionImportPreview } from "../../../actions";

type Preview = Extract<QuestionImportPreview, { ok: true }>;

const TEMPLATE_HREF = "/dashboard/courses/quiz-import-template";
const btn = "flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-50";

function RowCard({ r }: { r: ImportRow }) {
  const ok = !!r.question;
  return (
    <li className={`rounded-xl border p-3 ${ok ? "border-neutral-200 bg-white" : "border-red-200 bg-red-50"}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-xs font-bold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`} aria-label={ok ? "ถูกต้อง" : "มีปัญหา"}>{ok ? "✓" : "✗"}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-neutral-500">แถว {r.rowNo} ในไฟล์{ok && ` · ${r.question!.type === "SINGLE" ? "เลือกคำตอบเดียว" : "เลือกได้หลายข้อ"} · ${r.points} คะแนน`}</p>
          <p className="line-clamp-2 break-words font-medium leading-snug">{r.prompt || <span className="text-neutral-400">(ไม่มีคำถาม)</span>}</p>
          {r.choices.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 text-xs">
              {r.choices.map((c, i) => (
                <li key={i} className="max-w-full truncate rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">{c}</li>
              ))}
            </ul>
          )}
          {ok && <p className="text-xs text-green-700">เฉลย: {r.correct.join(", ")}</p>}
          {r.errors.length > 0 && <ul className="list-disc pl-5 text-xs font-medium text-red-700">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          {r.warnings.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-800">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
      </div>
    </li>
  );
}

/** "Import from Excel": the template + how-to, pick a file, check the preview, then add the valid questions after the existing ones. */
export default function QuizImport({ courseId, quizId, room }: { courseId: string; quizId: string; room: number }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [partial, setPartial] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ imported: number; skipped: { index: number; error: string }[] } | null>(null);
  const [pending, start] = useTransition();

  const reset = () => { setPreview(null); setError(""); if (fileRef.current) fileRef.current.value = ""; };

  function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    setDone(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const r = await previewQuestionImport(courseId, quizId, fd);
      if (!r.ok) { setPreview(null); setError(r.error); return; }
      setPreview(r);
    });
  }

  function runImport() {
    if (!preview) return;
    const valid = preview.rows.filter((r) => r.question);
    const inputs = valid.map((r) => {
      const q = r.question!;
      return q.type === "MULTI" ? { ...q, config: { ...q.config, scoring: partial ? "partial" : "all" } } : q;
    });
    setError("");
    start(async () => {
      const r = await importQuestions(courseId, quizId, inputs);
      if ("error" in r && r.error) { setError(r.error); return; }
      if ("imported" in r) { setDone({ imported: r.imported, skipped: r.skipped }); reset(); router.refresh(); }
    });
  }

  const hasMulti = !!preview?.rows.some((r) => r.question?.type === "MULTI");
  const tooMany = !!preview && preview.valid > preview.room;

  return (
    <section className="space-y-3 rounded-2xl border border-brand/30 bg-brand-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">นำเข้าข้อสอบปรนัยจาก Excel</h3>
          <p className="text-sm text-neutral-600">พิมพ์ข้อสอบหลายข้อใน Excel แล้วนำเข้าครั้งเดียว (ข้อสอบแบบเลือกคำตอบ ก ข ค ง)</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`${btn} border border-brand bg-white text-brand`}>{open ? "ซ่อน" : "นำเข้าจาก Excel"}</button>
      </div>

      {done && (
        <div role="status" className="space-y-1 rounded-xl bg-green-50 p-3 text-sm text-green-800">
          <p className="font-semibold">นำเข้าแล้ว {done.imported} ข้อ — เลื่อนดูในรายการคำถามด้านบน</p>
          {done.skipped.length > 0 && <p className="text-amber-800">ข้ามไป {done.skipped.length} ข้อ: {done.skipped.map((s) => `แถวที่ ${s.index + 1} ในรายการนำเข้า (${s.error})`).join(" · ")}</p>}
        </div>
      )}

      {open && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl bg-white p-4">
            <p className="font-semibold">ขั้นตอน</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-700">
              <li>ดาวน์โหลดแม่แบบ Excel (มีแท็บ “วิธีใช้” อธิบายครบ และแท็บ “แบบทดสอบ” ให้กรอก)</li>
              <li>พิมพ์ข้อสอบ 1 ข้อ ต่อ 1 แถว — คำถาม ตัวเลือก ก–ฉ <strong>เฉลย</strong> (เช่น <code className="rounded bg-neutral-100 px-1">ก</code> หรือ <code className="rounded bg-neutral-100 px-1">ข,ค</code> ถ้าถูกหลายข้อ) คะแนน คำอธิบายเฉลย</li>
              <li>บันทึกไฟล์ แล้วเลือกไฟล์ด้านล่าง ระบบจะแสดงตัวอย่างให้ตรวจก่อนนำเข้า</li>
            </ol>
            <details className="text-sm text-neutral-700">
              <summary className="cursor-pointer font-medium text-brand">ดูคำอธิบายคอลัมน์และข้อควรรู้</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>คำถาม</strong> และ <strong>เฉลย</strong> ต้องกรอก · ตัวเลือกต้องมี 2 ข้อขึ้นไป (สูงสุด 8: ก ข ค ง จ ฉ ช ซ) ตัวเลือกที่ไม่ใช้ปล่อยว่าง</li>
                <li><strong>เฉลย</strong> ใช้ ก ข ค ง หรือ A B C D หรือ 1 2 3 4 ได้ · ถูกข้อเดียว = “เลือกคำตอบเดียว” ถูกหลายข้อ (คั่นด้วย , ) = “เลือกได้หลายข้อ” ระบบตั้งให้เอง</li>
                <li><strong>คะแนน</strong> ไม่บังคับ (ว่าง = 1 คะแนน) · <strong>คำอธิบายเฉลย</strong> และ <strong>ลิงก์รูปประกอบ</strong> (Google Drive แชร์ “ทุกคนที่มีลิงก์” หรือ https) ไม่บังคับ</li>
                <li>นำเข้าเพิ่ม<strong>ต่อท้าย</strong>คำถามเดิม ไม่ลบของเดิม · รวมแล้วไม่เกิน 100 ข้อต่อแบบทดสอบ (ตอนนี้เหลือที่ว่างอีก <strong>{room}</strong> ข้อ)</li>
                <li>แถวที่มีปัญหาจะถูกข้าม และบอกเหตุผลพร้อมเลขแถวใน Excel — แก้แล้วนำเข้าใหม่เฉพาะแถวนั้นได้</li>
                <li>แถวตัวอย่างในแม่แบบ (ขึ้นต้นด้วย “(ตัวอย่าง)”) ระบบข้ามให้เอง ไม่ต้องลบ</li>
              </ul>
            </details>
            <a href={TEMPLATE_HREF} download className={`${btn} w-full border border-brand bg-brand-soft text-brand sm:w-auto`}>ดาวน์โหลดแม่แบบ Excel (.xlsx)</a>
          </div>

          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium">เลือกไฟล์ที่กรอกแล้ว (.xlsx หรือ .csv)</span>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={(e) => pick(e.target.files?.[0])} disabled={pending} className="block w-full text-sm" />
            </label>
            {pending && !preview && <p className="flex items-center gap-2 text-sm text-neutral-600"><Spinner className="h-4 w-4" />กำลังอ่านไฟล์…</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
          </div>

          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-white px-3 py-1 font-medium">{preview.fileName}</span>
                <span className="rounded-full bg-green-100 px-3 py-1 font-semibold text-green-800">นำเข้าได้ {preview.valid} ข้อ</span>
                {preview.invalid > 0 && <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-800">มีปัญหา {preview.invalid} แถว (จะถูกข้าม)</span>}
                {preview.exampleRows > 0 && <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-600">ข้ามแถวตัวอย่าง {preview.exampleRows}</span>}
              </div>
              <ol className="max-h-[28rem] space-y-2 overflow-y-auto rounded-xl bg-neutral-50 p-2">
                {preview.rows.map((r) => <RowCard key={r.rowNo} r={r} />)}
              </ol>
              {hasMulti && (
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>ข้อที่เลือกได้หลายคำตอบ ให้<strong>คะแนนบางส่วน</strong> (ถ้าไม่ติ๊ก ต้องเลือกถูกครบทุกข้อจึงได้คะแนน)</span>
                </label>
              )}
              {tooMany && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">แบบทดสอบนี้เหลือที่ว่างอีก {preview.room} ข้อ แต่ไฟล์มี {preview.valid} ข้อที่นำเข้าได้ — ลดจำนวนแถวหรือลบคำถามเดิมก่อน</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={runImport} disabled={pending || preview.valid === 0 || tooMany} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>{pending && <Spinner className="h-4 w-4" />}นำเข้า {preview.valid} ข้อ</button>
                <button type="button" onClick={reset} disabled={pending} className={`${btn} border border-neutral-300 bg-white`}>ยกเลิก</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
