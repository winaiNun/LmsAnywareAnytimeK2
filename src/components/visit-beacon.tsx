"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const BEAT_MS = 90_000;

/**
 * Counts this browser once per day and keeps an "online" heartbeat while the tab is visible.
 * Renders nothing; does nothing in the back office, and nothing at all when the admin switched the counters off
 * (the server then ignores the calls).
 */
export default function VisitBeacon() {
  const pathname = usePathname();
  const skip = pathname.startsWith("/admin");

  useEffect(() => {
    if (skip) return;
    // once per browser tab session is enough to ask (the server still decides by cookie whether today already counted)
    try {
      if (sessionStorage.getItem("lms.visit") === new Date().toDateString()) return;
      sessionStorage.setItem("lms.visit", new Date().toDateString());
    } catch {}
    fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => {});
  }, [skip]);

  useEffect(() => {
    if (skip) return;
    let sid = "";
    try {
      sid = sessionStorage.getItem("lms.sid") ?? "";
      if (!sid) {
        sid = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
        sessionStorage.setItem("lms.sid", sid);
      }
    } catch {
      sid = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    }
    const beat = () => {
      if (document.visibilityState === "visible") fetch("/api/online", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid }), keepalive: true }).catch(() => {});
    };
    beat();
    const t = setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", beat); };
  }, [skip]);

  return null;
}
