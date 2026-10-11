"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMedia, reviewMedia, setMediaPinned, unpublishMedia } from "../media/actions";

/** Approve / send back (when the item waits in the queue) + admin-only pin / unpublish / delete. */
export default function ReviewPanel({ id, status, canDecide, isAdmin, pinned, backHref }: { id: string; status: string; canDecide: boolean; isAdmin: boolean; pinned: boolean; backHref: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string }>, done?: string) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (r.error) return setError(r.error);
      if (done) router.push(done);
      router.refresh();
    });

  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm" aria-label="การตรวจสื่อ">
      {canDecide && (
        <div className="space-y-3">
          <h2 className="font-semibold">ผลการตรวจ</h2>
          <label className="block space-y-1">
            <span className="text-sm text-neutral-600">หมายเหตุถึงเจ้าของสื่อ (จำเป็นเมื่อส่งกลับ)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className="w-full rounded-lg border border-neutral-300 px-3 py-2" placeholder="เช่น ลิงก์ Drive เปิดไม่ได้ กรุณาตั้งแชร์เป็นทุกคนที่มีลิงก์" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button disabled={pending} onClick={() => run(() => reviewMedia(id, "approve", note), backHref)} className="min-h-12 rounded-xl bg-green-700 px-6 font-semibold text-white disabled:opacity-60">อนุมัติและเผยแพร่</button>
            <button disabled={pending} onClick={() => run(() => reviewMedia(id, "reject", note), backHref)} className="min-h-12 rounded-xl border border-red-300 px-6 font-semibold text-red-700 disabled:opacity-60">ส่งกลับให้แก้ไข</button>
          </div>
        </div>
      )}
      {!canDecide && status === "PENDING" && <p className="text-sm text-amber-800">คุณไม่มีสิทธิ์ตัดสินสื่อนี้ (เช่น เป็นสื่อของคุณเอง ต้องให้ผู้ตรวจคนอื่นหรือแอดมินตรวจ)</p>}
      {!canDecide && status !== "PENDING" && !isAdmin && <p className="text-sm text-neutral-500">สื่อนี้ไม่ได้อยู่ในสถานะรออนุมัติ</p>}

      {isAdmin && (
        <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
          {status === "PUBLISHED" && (
            <>
              <button disabled={pending} onClick={() => run(() => setMediaPinned(id, !pinned))} className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm">{pinned ? "เลิกปักหมุด" : "ปักหมุดไว้บนสุด"}</button>
              <button disabled={pending} onClick={() => { if (confirm("ถอนการเผยแพร่และกลับเป็นร่าง?")) run(() => unpublishMedia(id)); }} className="min-h-11 rounded-lg border border-amber-300 px-4 text-sm text-amber-800">ถอนการเผยแพร่</button>
            </>
          )}
          <button disabled={pending} onClick={() => { if (confirm("ลบสื่อนี้ถาวร?")) run(() => deleteMedia(id), backHref); }} className="min-h-11 rounded-lg border border-red-200 px-4 text-sm text-red-600">ลบสื่อ</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
