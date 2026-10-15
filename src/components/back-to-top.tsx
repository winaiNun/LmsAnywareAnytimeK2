"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

const SHOW_AFTER = 400; // px scrolled before the button appears

/** Round "back to top" button. Sits above the chat button; `offsetClass` positions it in the stack. */
export default function BackToTop({ label, offsetClass, suppressed = false }: { label: string; offsetClass: string; suppressed?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > SHOW_AFTER);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const show = scrolled && !suppressed;

  function toTop() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={label}
      title={label}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`fixed right-3 z-[55] flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-brand shadow-lg backdrop-blur transition-all duration-200 hover:bg-brand-soft motion-reduce:transition-none md:right-5 ${offsetClass} ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
    >
      <Icon name="arrowUp" className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}
