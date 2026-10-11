"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCourse } from "@/app/dashboard/courses/actions";
import { reviewCourse, setCourseEnrollOpen, unpublishCourse } from "../course-actions";

/** Approve / send back (while the course waits in the queue) + admin-only unpublish, sign-ups switch and delete. */
export default function CourseReviewPanel({ id, status, canDecide, isAdmin, enrollOpen, enrollments, backHref }: { id: string; status: string; canDecide: boolean; isAdmin: boolean; enrollOpen: boolean; enrollments: number; backHref: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string } | object>, done?: string) =>
    start(async () => {
      setError("");
      const r = await fn();
      if ("error" in r && r.error) return setError(r.error as string);
      if (done) router.push(done);
      router.refresh();
    });

  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm" aria-label="การตรวจคอร์ส">
      {canDecide && (
        <div className="space-y-3">
          <h2 className="font-semibold">ผลการตรวจ</h2>
          <label className="block space-y-1">
            <span className="text-sm text-neutral-600">หมายเหตุถึงผู้สร้างคอร์ส (จำเป็นเมื่อส่งกลับ)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className="w-full rounded-lg border border-neutral-300 px-3 py-2" placeholder="เช่น เฉลยข้อ 3 ไม่ถูกต้อง / วิดีโอในบทที่ 2 เปิดไม่ได้" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button disabled={pending} onClick={() => run(() => reviewCourse(id, "approve", note), backHref)} className="min-h-12 rounded-xl bg-green-700 px-6 font-semibold text-white disabled:opacity-60">อนุมัติและเผยแพร่</button>
            <button disabled={pending} onClick={() => run(() => reviewCourse(id, "reject", note), backHref)} className="min-h-12 rounded-xl border border-red-300 px-6 font-semibold text-red-700 disabled:opacity-60">ส่งกลับให้แก้</button>
          </div>
        </div>
      )}
      {!canDecide && status === "PENDING" && <p className="text-sm text-amber-800">คุณไม่มีสิทธิ์ตัดสินคอร์สนี้ (เช่น เป็นคอร์สของคุณเอง ต้องให้ผู้ตรวจคนอื่นหรือผู้ดูแลระบบอนุมัติ)</p>}
      {!canDecide && status !== "PENDING" && !isAdmin && <p className="text-sm text-neutral-500">คอร์สนี้ไม่ได้อยู่ในสถานะรออนุมัติ</p>}

      {isAdmin && (
        <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
          <Link href={`/dashboard/courses/${id}/edit`} className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 text-sm">แก้ไขคอร์ส</Link>
          {status === "PUBLISHED" && (
            <>
              <button disabled={pending} onClick={() => run(() => setCourseEnrollOpen(id, !enrollOpen))} className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm">{enrollOpen ? "ปิดรับลงทะเบียน" : "เปิดรับลงทะเบียน"}</button>
              <button disabled={pending} onClick={() => { if (confirm("ยกเลิกการเผยแพร่และกลับเป็นร่าง? ผู้เรียนเดิมเก็บความคืบหน้าไว้ แต่เปิดเรียนไม่ได้จนกว่าจะเผยแพร่ใหม่")) run(() => unpublishCourse(id)); }} className="min-h-11 rounded-lg border border-amber-300 px-4 text-sm text-amber-800">ยกเลิกการเผยแพร่</button>
            </>
          )}
          <button disabled={pending || enrollments > 0} title={enrollments > 0 ? "มีผู้เรียนแล้ว ลบไม่ได้ — ยกเลิกการเผยแพร่แทน" : ""} onClick={() => { if (confirm("ลบคอร์สนี้ถาวร (บทเรียน แบบทดสอบ ภาพปก)?")) run(() => deleteCourse(id), backHref); }} className="min-h-11 rounded-lg border border-red-200 px-4 text-sm text-red-600 disabled:opacity-40">ลบคอร์ส</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
