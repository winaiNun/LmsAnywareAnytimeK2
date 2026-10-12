"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmCertificateAction } from "@/app/courses/learn-actions";

/** The learner's one click for an automatic number series: check the name, then take the next number. */
export default function ConfirmCertificate({ courseId, name, title, note, button }: { courseId: string; name: string; title: string; note: string; button: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 rounded-xl border border-brand/30 bg-brand-soft p-4">
      <p className="font-semibold text-brand">{title}</p>
      <p className="rounded-lg bg-white px-4 py-3 text-lg font-bold">{name}</p>
      <p className="text-sm text-neutral-700">{note}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError("");
            start(async () => {
              const r = await confirmCertificateAction(courseId);
              if (r.ok) router.refresh(); else setError(r.error);
            });
          }}
          className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >{pending ? "กำลังออกเลข…" : button}</button>
        <Link href="/dashboard" className="flex min-h-12 items-center justify-center rounded-xl border border-neutral-300 bg-white px-6 text-sm font-semibold">แก้ชื่อที่หน้าบัญชี</Link>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
