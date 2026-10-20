"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Glyph from "@/components/glyph";
import { deleteCourse, submitCourse, withdrawCourse } from "../../actions";

/** "Ready?" checklist, send for review (admins: publish), withdraw, delete. */
export default function SubmitTab({ courseId, status, problems, isAdmin, reviewNote, enrollments, selfPublish = false }: { courseId: string; status: string; problems: string[]; isAdmin: boolean; selfPublish?: boolean; reviewNote: string | null; enrollments: number }) {
  const router = useRouter();
  const direct = isAdmin || selfPublish; // publishes at once (no review queue)
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const ready = problems.length === 0;

  const run = (fn: () => Promise<{ error?: string } | object>, ok: string, then?: () => void) =>
    start(async () => {
      setError("");
      setMsg("");
      const r = await fn();
      if ("error" in r && r.error) return setError(r.error as string);
      setMsg(ok);
      then?.();
      router.refresh();
    });

  return (
    <section className="space-y-4">
      {status === "REJECTED" && reviewNote && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><strong>ผู้ตรวจส่งกลับให้แก้:</strong> {reviewNote}</p>}
      {status === "PENDING" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">คอร์สนี้ส่งตรวจแล้ว กำลังรอผู้ตรวจอนุมัติ — ระหว่างนี้แก้ไขได้ แต่จะยังไม่แสดงบนเว็บ</p>}
      {status === "PUBLISHED" && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">คอร์สนี้เผยแพร่อยู่ · {enrollments} ผู้เรียน{!isAdmin && " · ถ้าแก้ไขคอร์ส ระบบจะส่งกลับไปรอตรวจใหม่และซ่อนจากหน้าเว็บชั่วคราว (ผู้เรียนเดิมเก็บความคืบหน้าไว้)"}</p>}

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">ความพร้อมของคอร์ส</h2>
        {ready ? (
          <p className="flex items-center gap-2 text-sm font-medium text-green-700"><Glyph name="check" size={18} strokeWidth={2.4} />ครบถ้วน พร้อม{isAdmin ? "เผยแพร่" : "ส่งตรวจ"}</p>
        ) : (
          <ul className="space-y-1.5 text-sm text-red-700">
            {problems.map((p) => <li key={p} className="flex gap-2"><span aria-hidden>•</span><span>{p}</span></li>)}
          </ul>
        )}
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {msg && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        {status !== "PUBLISHED" || direct ? (
          <button disabled={pending || !ready || (!direct && status === "PENDING")} onClick={() => run(() => submitCourse(courseId), direct ? "เผยแพร่แล้ว" : "ส่งตรวจแล้ว", () => router.push(`/dashboard/courses?saved=${direct ? "PUBLISHED" : "PENDING"}`))} className="min-h-12 rounded-xl bg-brand px-7 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {direct ? (status === "PUBLISHED" ? "เผยแพร่ซ้ำ" : "เผยแพร่") : status === "PENDING" ? "ส่งตรวจแล้ว" : "ส่งขออนุมัติ"}
          </button>
        ) : null}
        {status === "PENDING" && <button disabled={pending} onClick={() => run(() => withdrawCourse(courseId), "ถอนกลับเป็นร่างแล้ว")} className="min-h-12 rounded-xl border border-neutral-300 px-6 font-semibold disabled:opacity-50">ถอนกลับเป็นร่าง</button>}
        <Link href="/dashboard/courses" className="flex min-h-12 items-center rounded-xl border border-neutral-300 px-6 font-semibold">กลับไปคอร์สของฉัน</Link>
        {(isAdmin || status !== "PUBLISHED") && enrollments === 0 && (
          <button disabled={pending} onClick={() => { if (confirm("ลบคอร์สนี้ทั้งหมด (บทเรียน แบบทดสอบ และภาพปก)? ย้อนกลับไม่ได้")) run(() => deleteCourse(courseId), "ลบแล้ว", () => router.push("/dashboard/courses?saved=DELETED")); }} className="min-h-12 rounded-xl border border-red-200 px-6 font-semibold text-red-600 disabled:opacity-50">ลบคอร์ส</button>
        )}
      </div>
    </section>
  );
}
