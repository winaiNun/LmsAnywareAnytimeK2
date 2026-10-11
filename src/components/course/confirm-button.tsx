"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmLesson } from "@/app/courses/learn-actions";
import Glyph from "@/components/glyph";
import { Spinner } from "@/components/icons";

/** "I have studied this lesson" — for lessons whose content cannot be measured (text, links, files). */
export default function ConfirmButton({ courseId, lessonId, confirmed }: { courseId: string; lessonId: string; confirmed: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (confirmed) return <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700"><Glyph name="check" size={16} strokeWidth={2.6} />ยืนยันแล้วว่าเรียนบทนี้</p>;
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          setError("");
          const r = await confirmLesson(courseId, lessonId);
          if ("error" in r) return setError(r.error);
          router.refresh();
        })}
        className="flex min-h-12 items-center gap-2 rounded-xl border border-brand px-6 font-semibold text-brand hover:bg-brand-soft disabled:opacity-60"
      >
        {pending ? <Spinner className="h-4 w-4" /> : <Glyph name="check" size={18} strokeWidth={2.4} />}ฉันเรียนบทนี้แล้ว
      </button>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
