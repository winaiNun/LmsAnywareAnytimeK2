"use client";

import { useEffect, useRef, useState } from "react";
import Glyph from "@/components/glyph";

/* eslint-disable @typescript-eslint/no-explicit-any -- the YouTube IFrame API has no bundled types */
declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

type Segment = [number, number];
const REPORT_EVERY_MS = 30_000;
const MAX_RATE = 1.5; // the server accepts at most 1.5x of real time; faster playback is not counted

let loader: Promise<any> | null = null;
/** Load the YouTube IFrame API once (a test can define window.YT beforehand to stand in for it). */
function loadYouTube(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loader ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => { loader = null; reject(new Error("youtube")); };
    document.head.appendChild(s);
  });
  return loader;
}

/**
 * A YouTube video that counts how much of it is really watched. Every second of continuous playing is collected into
 * "segments"; every ~30 s (and when the video pauses, ends, or the page is hidden/closed) they are sent to the server,
 * which checks them against real time. `record = false` (a preview) plays the video and sends nothing.
 */
export default function YouTubePlayer({ blockId, videoId, start = 0, record, minPercent, initialPercent, label, onDone }: { blockId: string; videoId: string; start?: number; record: boolean; minPercent: number; initialPercent: number; label?: string; onDone?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState(initialPercent);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const doneFired = useRef(initialPercent >= minPercent);

  useEffect(() => {
    let player: any;
    let timer: ReturnType<typeof setInterval> | undefined;
    let sendTimer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    let cur: { from: number; to: number } | null = null;
    let pending: Segment[] = [];
    let lastSend = Date.now();
    let sending = false;
    let playing = false;

    const flush = () => {
      if (cur && cur.to - cur.from >= 1) pending.push([Math.round(cur.from * 10) / 10, Math.round(cur.to * 10) / 10]);
      cur = null;
    };

    /** Sends what has been collected (callers close the running stretch first with flush()). */
    async function send() {
      if (!record || sending || pending.length === 0 || !player) return;
      const batch = pending.slice(0, 40);
      pending = pending.slice(40);
      const duration = Math.round(player.getDuration?.() ?? 0);
      if (!duration) { pending = [...batch, ...pending]; return; }
      sending = true;
      lastSend = Date.now();
      try {
        const res = await fetch("/api/courses/watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blockId, durationSec: duration, segments: batch }), keepalive: true });
        if (res.status === 429 || res.status >= 500) pending = [...batch, ...pending]; // not the learner's fault: try again later
        else if (res.ok) {
          const d = (await res.json()) as { percent: number };
          if (alive) { setPercent(d.percent); if (d.percent >= minPercent && !doneFired.current) { doneFired.current = true; onDone?.(); } }
        }
      } catch {
        pending = [...batch, ...pending];
      } finally {
        sending = false;
      }
    }
    const sendSoon = () => { clearTimeout(sendTimer); const wait = Math.max(0, 5000 - (Date.now() - lastSend)); sendTimer = setTimeout(send, wait); };

    function tick() {
      if (!playing || !player) return;
      const rate = player.getPlaybackRate?.() ?? 1;
      if (rate > MAX_RATE) { flush(); setNotice("ปรับความเร็วไม่เกิน 1.5 เท่า ระบบจึงจะนับการดู"); return; }
      setNotice("");
      const t = player.getCurrentTime?.() ?? 0;
      if (cur && t >= cur.to - 0.3 && t - cur.to <= 2.5) cur.to = t;
      else { flush(); cur = { from: t, to: t }; }
      if (Date.now() - lastSend >= REPORT_EVERY_MS) {
        // close the running stretch so it is included, and carry on from where it ended
        const end = cur?.to ?? t;
        flush();
        cur = { from: end, to: end };
        send();
      }
    }

    loadYouTube().then((YT) => {
      if (!alive || !box.current) return;
      const target = document.createElement("div");
      box.current.innerHTML = "";
      box.current.appendChild(target);
      player = new YT.Player(target, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start, enablejsapi: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            const S = YT.PlayerState;
            const now = e.data === S.PLAYING;
            if (now && !playing) { /* a new stretch starts at the next tick */ }
            if (!now && playing) { flush(); sendSoon(); }
            if (e.data === S.ENDED) { flush(); sendSoon(); }
            playing = now;
          },
        },
      });
      timer = setInterval(tick, 1000);
    }).catch(() => setFailed(true));

    const hide = () => { if (document.visibilityState === "hidden") { flush(); send(); } };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", hide);
    return () => {
      alive = false;
      clearInterval(timer);
      clearTimeout(sendTimer);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", hide);
      flush();
      send();
      try { player?.destroy?.(); } catch {}
    };
  }, [blockId, videoId, start, record, minPercent]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = percent >= minPercent;
  return (
    <div className="space-y-2">
      {label && <p className="font-semibold">{label}</p>}
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <div ref={box} className="h-full w-full" />
      </div>
      {failed && <p role="alert" className="text-sm text-red-600">โหลดตัวเล่น YouTube ไม่สำเร็จ ลองรีเฟรชหน้า หรือ <a className="underline" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">เปิดใน YouTube</a> (ระบบจะไม่นับการดู)</p>}
      {record ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className={`inline-flex items-center gap-1.5 font-medium ${done ? "text-green-700" : "text-neutral-700"}`}>{done && <Glyph name="check" size={16} strokeWidth={2.6} />}ดูแล้ว {percent}%{!done && <span className="font-normal text-neutral-500"> · ต้องดูถึง {minPercent}% จึงจะนับว่าเรียนจบ</span>}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้าการดูวิดีโอ"><div className={`h-full rounded-full transition-[width] ${done ? "bg-green-600" : "bg-brand"}`} style={{ width: `${percent}%` }} /></div>
          {notice && <p role="status" className="text-xs font-medium text-amber-700">{notice}</p>}
        </div>
      ) : <p className="text-xs text-neutral-500">ตัวอย่าง — ไม่บันทึกความคืบหน้า</p>}
    </div>
  );
}
