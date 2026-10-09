"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "pwa-install-dismissed";

/** Registers the service worker and offers "add to home screen" (Android prompt / iOS instructions). */
export default function Pwa() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

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
  return (
    <div role="dialog" aria-label="ติดตั้งแอป" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl bg-[#0B2A6F] p-4 text-white shadow-2xl" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <p className="font-semibold">ติดตั้งแอปไว้บนหน้าจอโทรศัพท์</p>
      {ios ? (
        <p className="mt-1 text-sm text-white/85">แตะปุ่ม <span aria-label="แชร์">แชร์ (⬆︎)</span> ใน Safari แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”</p>
      ) : (
        <p className="mt-1 text-sm text-white/85">เปิดใช้ได้เร็วเหมือนแอป ไม่ต้องพิมพ์ที่อยู่เว็บ</p>
      )}
      <div className="mt-3 flex gap-2">
        {deferred && (
          <button onClick={async () => { await deferred.prompt(); await deferred.userChoice; setDeferred(null); dismiss(); }} className="min-h-11 flex-1 rounded-full bg-white font-semibold text-[#0B2A6F]">ติดตั้ง</button>
        )}
        <button onClick={dismiss} className="min-h-11 flex-1 rounded-full border border-white/50">ไว้ก่อน</button>
      </div>
    </div>
  );
}
