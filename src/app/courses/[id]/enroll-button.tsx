"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Spinner } from "@/components/icons";
import { enroll } from "../actions";

/** "Enrol" for a member who is signed in (then "continue"), a login link for a visitor. */
export default function EnrollButton({ courseId, signedIn, enrolled, open, continueHref, preview }: { courseId: string; signedIn: boolean; enrolled: boolean; open: boolean; continueHref: string | null; preview: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const primary = "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-8 font-semibold text-white hover:bg-brand-dark disabled:opacity-60 sm:w-auto";

  if (preview && continueHref) return <Link href={continueHref} className={primary}>เปิดดูบทเรียน (ตัวอย่าง)</Link>;
  if (enrolled) return continueHref ? <Link href={continueHref} className={primary}>เรียนต่อ</Link> : <p className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">คอร์สนี้ยังไม่มีบทเรียนให้เปิด</p>;
  if (!open) return <p className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">คอร์สนี้ปิดรับลงทะเบียนแล้ว</p>;
  if (!signedIn) return <Link href={`/login?callbackUrl=/courses/${courseId}`} className={primary}>เข้าสู่ระบบเพื่อลงทะเบียนเรียน</Link>;

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { setError(""); const r = await enroll(courseId); if ("error" in r) return setError(r.error); router.refresh(); })}
        className={primary}
      >
        {pending && <Spinner className="h-4 w-4" />}ลงทะเบียนเรียน
      </button>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
