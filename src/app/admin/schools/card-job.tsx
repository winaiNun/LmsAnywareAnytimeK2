"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/icons";
import { listCardTodoIds, refreshCards } from "./actions";

const BATCH = 4; // a few per request: keeps each call short and polite to Google Drive

/**
 * Downloads each school's card picture from its Drive link, a few at a time, with a progress bar.
 * Safe to stop and run again — it only touches schools that still have no picture (or failed).
 */
export default function CardJob({ missing }: { missing: number }) {
  const router = useRouter();
  const [state, setState] = useState<{ running: boolean; done: number; total: number; ok: number; failed: { id: string; error: string }[]; finished: boolean }>({ running: false, done: 0, total: 0, ok: 0, failed: [], finished: false });
  const stop = useRef(false);

  async function run(onlyMissing: boolean) {
    stop.current = false;
    const ids = await listCardTodoIds(onlyMissing);
    setState({ running: true, done: 0, total: ids.length, ok: 0, failed: [], finished: false });
    let ok = 0;
    const failed: { id: string; error: string }[] = [];
    for (let i = 0; i < ids.length && !stop.current; i += BATCH) {
      const res = await refreshCards(ids.slice(i, i + BATCH));
      for (const r of res) {
        if (r.ok) ok += 1;
        else failed.push({ id: r.id, error: r.error ?? "ไม่สำเร็จ" });
      }
      setState({ running: true, done: Math.min(i + BATCH, ids.length), total: ids.length, ok, failed: [...failed], finished: false });
    }
    setState((s) => ({ ...s, running: false, finished: true }));
    router.refresh();
  }

  const pct = state.total ? Math.round((state.done / state.total) * 100) : 0;
  if (missing === 0 && !state.running && !state.finished) return null;

  return (
    <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4" aria-label="ดึงภาพการ์ดจาก Google Drive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-amber-900">
          {state.finished ? "ดึงภาพการ์ดเสร็จแล้ว" : <>มี <strong>{missing}</strong> โรงเรียนที่ยังไม่มีภาพการ์ด — ระบบดึงภาพจากลิงก์ Google Drive แล้วย่อเก็บไว้เอง (ใช้เวลาประมาณ 1 วินาทีต่อโรงเรียน)</>}
        </p>
        {!state.running ? (
          <button type="button" onClick={() => run(true)} className="min-h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">
            {state.finished ? "ลองดึงที่ไม่สำเร็จอีกครั้ง" : "ดึงภาพการ์ดที่ยังไม่มี"}
          </button>
        ) : (
          <button type="button" onClick={() => { stop.current = true; }} className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-400 bg-white px-5 text-sm">
            <Spinner className="h-4 w-4" /> หยุด
          </button>
        )}
      </div>
      {(state.running || state.finished) && (
        <div className="space-y-1" role="status">
          <div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="text-xs text-neutral-700">{state.done}/{state.total} · สำเร็จ {state.ok} · ไม่สำเร็จ {state.failed.length}</p>
          {state.finished && state.failed.length > 0 && (
            <details className="text-xs text-red-700"><summary className="cursor-pointer">ดูรายการที่ไม่สำเร็จ ({state.failed.length})</summary>
              <ul className="mt-1 list-disc pl-5">{[...new Set(state.failed.map((f) => f.error))].map((e) => <li key={e}>{e} ({state.failed.filter((f) => f.error === e).length} โรงเรียน)</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
