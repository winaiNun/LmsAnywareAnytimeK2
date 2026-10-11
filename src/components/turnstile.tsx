"use client";

import { useEffect, useRef } from "react";

type Api = { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window { turnstile?: Api }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

let loader: Promise<void> | null = null;
function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loader = null; reject(new Error("turnstile")); };
    document.head.appendChild(s);
  });
  return loader;
}

/**
 * Cloudflare Turnstile widget. Renders nothing when no site key is configured (local development).
 * A token works once: change `resetKey` after a failed attempt to get a fresh one.
 */
export default function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let id: string | undefined;
    let gone = false;
    cb.current("");
    load().then(() => {
      if (gone || !box.current || !window.turnstile) return;
      id = window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        language: "th",
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(""),
        "error-callback": () => cb.current(""),
      });
    }).catch(() => {});
    return () => { gone = true; if (id) window.turnstile?.remove(id); };
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={box} className="flex min-h-[65px] justify-center" aria-label="ตรวจสอบว่าไม่ใช่บอต" />;
}

export const turnstileOn = !!SITE_KEY;
