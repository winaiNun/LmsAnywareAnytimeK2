"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setMediaLike } from "../actions";

const SIX_HOURS = 6 * 3600 * 1000;

/** Counts one view per browser per 6 hours, after the page is on screen. Renders nothing. */
export function ViewCounter({ mediaId, enabled }: { mediaId: string; enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const key = `mv:${mediaId}`;
    try {
      const last = Number(localStorage.getItem(key) ?? 0);
      if (last && Date.now() - last < SIX_HOURS) return;
      localStorage.setItem(key, String(Date.now()));
    } catch {}
    fetch(`/api/media/${mediaId}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [mediaId, enabled]);
  return null;
}

export function LikeButton({ mediaId, initialLiked, initialCount, enabled }: { mediaId: string; initialLiked: boolean; initialCount: number; enabled: boolean }) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [msg, setMsg] = useState("");
  const [, start] = useTransition();

  function click() {
    if (!enabled) return;
    const next = !liked;
    setLiked(next); setCount((c) => Math.max(0, c + (next ? 1 : -1))); setMsg(""); // optimistic
    start(async () => {
      const r = await setMediaLike(mediaId, next);
      if (r.ok) { setLiked(r.liked); setCount(r.likeCount); return; }
      setLiked(!next); setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      if (r.needLogin) router.push(`/login?callbackUrl=${encodeURIComponent(`/library/${mediaId}`)}`);
      else setMsg(r.error);
    });
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={click}
        aria-pressed={liked}
        aria-label={liked ? "เลิกถูกใจ" : "ถูกใจสื่อนี้"}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition active:scale-95 ${liked ? "border-rose-300 bg-rose-50 text-rose-600" : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"}`}
      >
        <span aria-hidden className="text-lg leading-none">{liked ? "♥" : "♡"}</span>
        ถูกใจ <span className="tabular-nums">{count.toLocaleString("th-TH")}</span>
      </button>
      {msg && <span role="alert" className="mt-1 text-xs text-red-600">{msg}</span>}
    </span>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [done, setDone] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {}
  }
  return (
    <button type="button" onClick={share} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
      <span aria-hidden>↗</span>{done ? "คัดลอกลิงก์แล้ว" : "แชร์"}
    </button>
  );
}
