"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import SitePageBody from "@/components/site-page-body";

export type FaqTexts = {
  button: string;
  heading: string;
  subtitle: string;
  greeting: string;
  placeholder: string;
  hint: string;
  suggest: string;
  related: string;
  fallback: string;
  contact: string;
};
export type Starter = { id: string; question: string };

type Brief = { id: string; question: string };
type Msg =
  | { role: "user"; text: string }
  | { role: "bot"; kind: "greeting" }
  | { role: "bot"; kind: "answer"; answer: string; related: Brief[] }
  | { role: "bot"; kind: "suggest"; items: Brief[] }
  | { role: "bot"; kind: "none" }
  | { role: "bot"; kind: "error"; text: string };

const MAX_LEN = 200;
const chip =
  "group flex w-full items-center justify-between gap-3 rounded-xl border border-brand/15 bg-brand-soft/60 px-3.5 py-2.5 text-left text-sm font-medium text-brand-dark transition hover:border-brand/40 hover:bg-brand-soft hover:shadow-sm disabled:opacity-50 motion-reduce:transition-none";
const botBubble = "min-w-0 max-w-[85%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm leading-relaxed text-neutral-800 shadow-sm ring-1 ring-neutral-200/80";
const userBubble = "max-w-[82%] break-words rounded-2xl rounded-tr-md bg-gradient-to-br from-brand to-brand-dark px-4 py-2.5 text-sm text-white shadow-md shadow-brand/20";
const GRADIENT = "bg-gradient-to-br from-[#2F7BFF] via-brand to-[#0033A8]";

/** Round badge: the site logo on white, or the chat glyph when there is no logo. */
function Badge({ logoUrl, size }: { logoUrl: string | null; size: "sm" | "md" }) {
  const box = size === "md" ? "h-11 w-11" : "h-8 w-8";
  return (
    <span className={`${box} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
      ) : (
        <Icon name="chat" className={size === "md" ? "h-5 w-5 text-brand" : "h-4 w-4 text-brand"} strokeWidth={2} />
      )}
    </span>
  );
}

function Chips({ items, busy, onPick }: { items: Brief[]; busy: boolean; onPick: (payload: { id: string }, shown: string) => void }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {items.map((i) => (
        <button key={i.id} type="button" disabled={busy} onClick={() => onPick({ id: i.id }, i.question)} className={chip}>
          <span className="min-w-0">{i.question}</span>
          <Icon name="arrowRight" className="h-4 w-4 shrink-0 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:transition-none" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

/**
 * Floating FAQ chat. Answers come from the admin's Q&A (nothing is generated). The conversation lives only in this
 * component's state: closing the page forgets it, and nothing about the visitor is sent except the typed question.
 */
export default function FaqWidget({ texts, starters, logoUrl, bottomClass, open, onOpenChange }: { texts: FaqTexts; starters: Starter[]; logoUrl: string | null; bottomClass: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "bot", kind: "greeting" }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const titleId = useId();

  // focus the input on open, give focus back to the button on close
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [msgs, busy, open]);

  const ask = useCallback(async (payload: { q: string } | { id: string }, shown: string) => {
    setMsgs((m) => [...m, { role: "user", text: shown }]);
    setBusy(true);
    try {
      const res = await fetch("/api/faq/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setMsgs((m) => [...m, { role: "bot", kind: "error", text: data?.error ?? "ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" }]);
      } else if (data.kind === "answer") {
        setMsgs((m) => [...m, { role: "bot", kind: "answer", answer: data.answer, related: data.related ?? [] }]);
      } else if (data.kind === "suggest") {
        setMsgs((m) => [...m, { role: "bot", kind: "suggest", items: data.items }]);
      } else {
        setMsgs((m) => [...m, { role: "bot", kind: "none" }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "bot", kind: "error", text: "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่" }]);
    } finally {
      setBusy(false);
    }
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim().slice(0, MAX_LEN);
    if (!q || busy) return;
    setText("");
    void ask({ q }, q);
  }

  // Esc closes; Tab stays inside the panel
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onOpenChange(false);
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href]");
    if (!nodes?.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div className={`fixed right-3 z-[55] md:right-5 ${bottomClass}`}>
        {/* a short attention ring on first sight; never when the panel is open or motion is reduced */}
        {!open && <span aria-hidden className="pointer-events-none absolute inset-0 animate-faq-ping rounded-full bg-brand motion-reduce:hidden" />}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-label={texts.button}
          aria-expanded={open}
          title={texts.button}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full ${GRADIENT} text-white shadow-[0_12px_28px_-6px_rgba(0,64,204,0.6)] ring-1 ring-white/30 transition duration-200 hover:scale-105 hover:shadow-[0_16px_34px_-6px_rgba(0,64,204,0.7)] active:scale-95 motion-reduce:transition-none`}
        >
          <Icon name={open ? "close" : "chat"} className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>

      {open && (
        <>
          {/* phone: dim the page, tap outside to close */}
          <div className="fixed inset-0 z-[64] bg-neutral-900/40 backdrop-blur-[2px] md:hidden" onClick={() => onOpenChange(false)} aria-hidden />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            onKeyDown={onKeyDown}
            className="fixed inset-x-0 bottom-0 z-[65] flex h-[min(82dvh,640px)] animate-faq-sheet flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-12px_48px_-8px_rgba(0,30,120,0.35)] motion-reduce:animate-none md:inset-x-auto md:bottom-[4.75rem] md:right-5 md:h-[min(560px,calc(100dvh-7rem))] md:w-[392px] md:animate-faq-panel md:rounded-3xl md:shadow-[0_24px_64px_-12px_rgba(0,30,120,0.4)] md:ring-1 md:ring-black/5"
          >
            <div className={`relative overflow-hidden ${GRADIENT} px-4 pb-4 pt-3 text-white md:pt-4`}>
              <span aria-hidden className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
              <span aria-hidden className="absolute -bottom-12 right-10 h-24 w-24 rounded-full bg-white/10" />
              <span aria-hidden className="mx-auto mb-2 block h-1 w-10 rounded-full bg-white/40 md:hidden" />
              <div className="relative flex items-center gap-3">
                <Badge logoUrl={logoUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="truncate text-base font-bold leading-tight">{texts.heading}</h2>
                  <p className="truncate text-xs text-white/80">{texts.subtitle}</p>
                </div>
                <button type="button" onClick={() => onOpenChange(false)} aria-label="ปิด" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/25 motion-reduce:transition-none">
                  <Icon name="close" className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>

            <div role="log" aria-live="polite" className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-neutral-50 to-white p-4 [scrollbar-width:thin]">
              {msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex animate-faq-msg justify-end motion-reduce:animate-none">
                    <p className={userBubble}>{m.text}</p>
                  </div>
                ) : (
                  <div key={i} className="flex animate-faq-msg items-start gap-2 motion-reduce:animate-none">
                    <Badge logoUrl={logoUrl} size="sm" />
                    <div className={botBubble}>
                      {m.kind === "greeting" && (
                        <>
                          <p>{texts.greeting}</p>
                          {starters.length > 0 && <Chips busy={busy} onPick={ask} items={starters} />}
                        </>
                      )}
                      {m.kind === "answer" && (
                        <>
                          <SitePageBody body={m.answer} compact />
                          {m.related.length > 0 && (
                            <>
                              <p className="mt-4 text-xs font-semibold text-neutral-400">{texts.related}</p>
                              <Chips busy={busy} onPick={ask} items={m.related} />
                            </>
                          )}
                        </>
                      )}
                      {m.kind === "suggest" && (
                        <>
                          <p>{texts.suggest}</p>
                          <Chips busy={busy} onPick={ask} items={m.items} />
                        </>
                      )}
                      {m.kind === "none" && (
                        <>
                          <p>{texts.fallback}</p>
                          {starters.length > 0 && <Chips busy={busy} onPick={ask} items={starters.slice(0, 4)} />}
                          <Link href="/contact" onClick={() => onOpenChange(false)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand underline-offset-2 hover:underline">
                            {texts.contact}
                            <Icon name="arrowRight" className="h-4 w-4" strokeWidth={2} />
                          </Link>
                        </>
                      )}
                      {m.kind === "error" && <p className="text-red-700">{m.text}</p>}
                    </div>
                  </div>
                ),
              )}
              {busy && (
                <div className="flex items-start gap-2" role="status" aria-label="กำลังค้นหาคำตอบ">
                  <Badge logoUrl={logoUrl} size="sm" />
                  <div className={`${botBubble} flex gap-1.5 py-3.5`}>
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-brand/50 motion-reduce:animate-none" style={{ animationDelay: `${d * 120}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={submit} className="border-t border-neutral-200/80 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <div className="flex items-center gap-2 rounded-full border border-neutral-300 bg-neutral-50 py-1 pl-4 pr-1 transition focus-within:border-brand focus-within:bg-white focus-within:ring-4 focus-within:ring-brand/15 motion-reduce:transition-none">
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  // Enter that confirms a Thai/IME word must not send the message
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.nativeEvent.isComposing) e.preventDefault();
                  }}
                  maxLength={MAX_LEN}
                  placeholder={texts.placeholder}
                  aria-label={texts.placeholder}
                  autoComplete="off"
                  enterKeyHint="send"
                  className="min-h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400"
                />
                {text.length > 150 && <span className="text-xs tabular-nums text-neutral-400">{text.length}/{MAX_LEN}</span>}
                <button type="submit" disabled={busy || !text.trim()} aria-label="ส่งคำถาม" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${GRADIENT} text-white shadow-md shadow-brand/30 transition hover:brightness-110 disabled:opacity-35 disabled:shadow-none motion-reduce:transition-none`}>
                  <Icon name="send" className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] leading-snug text-neutral-400">{texts.hint}</p>
            </form>
          </div>
        </>
      )}
    </>
  );
}
