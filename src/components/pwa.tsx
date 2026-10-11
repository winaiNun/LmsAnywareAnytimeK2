"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "pwa-install-dismissed";

/** Registers the service worker and offers "add to home screen" (Android prompt / iOS instructions). */
export default function Pwa() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [tip, setTip] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(DISMISS_KEY); } catch {}
    if (standalone || dismissed) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIos) { setIos(true); setHidden(false); }
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as InstallEvent); setHidden(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }

  if (hidden || (!deferred && !ios)) return null;

  // A small chip in the bottom-left corner (above the phone tab bar), never a big dialog.
  return (
    <div className="fixed left-3 z-[60] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4" role="region" aria-label="ติดตั้งแอป">
      {tip && (
        <p className="mb-2 w-56 rounded-xl bg-[#0B2A6F] p-3 text-xs leading-relaxed text-white shadow-xl">
          แตะปุ่ม <strong>แชร์ (⬆︎)</strong> ใน Safari แล้วเลือก <strong>“เพิ่มไปยังหน้าจอโฮม”</strong>
        </p>
      )}
      <div className="flex items-center rounded-full bg-[#0B2A6F] pl-1 text-white shadow-lg ring-1 ring-white/20">
        <button
          type="button"
          onClick={async () => {
            if (deferred) { await deferred.prompt(); await deferred.userChoice; setDeferred(null); dismiss(); }
            else setTip((v) => !v);
          }}
          className="flex min-h-10 items-center gap-1.5 rounded-full pl-2.5 pr-2 text-sm font-semibold"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
          ติดตั้งแอป
        </button>
        <button type="button" onClick={dismiss} aria-label="ปิดข้อความนี้" className="flex h-10 w-9 items-center justify-center rounded-full text-white/70 hover:text-white">×</button>
      </div>
    </div>
  );
}
