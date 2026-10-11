"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMedia } from "./actions";

export default function DeleteMediaButton({ id, title, after }: { id: string; title: string; after?: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`ลบ “${title}” ถาวร?`)) return;
          start(async () => {
            const r = await deleteMedia(id);
            if (r.error) setMsg(r.error);
            else { if (after) router.push(after); router.refresh(); }
          });
        }}
        className="min-h-10 rounded-lg border border-red-200 px-3 text-sm text-red-600 disabled:opacity-50"
      >
        ลบ
      </button>
      {msg && <span role="alert" className="text-xs text-red-600">{msg}</span>}
    </span>
  );
}
