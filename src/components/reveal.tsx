"use client";

import { useEffect, useRef } from "react";

export type RevealVariant = "rise" | "zoom" | "fade";

// One observer for the whole page: each element gets `data-in` the first time it scrolls into view, then is released.
let observer: IntersectionObserver | null = null;
const getObserver = () =>
  (observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.setAttribute("data-in", "");
        observer?.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  ));

/**
 * Scroll-in effect (see .reveal in globals.css): opacity + transform only, plays once, no library.
 * The hidden state only applies when scripting is on, and a CSS fail-safe shows the content anyway if hydration is slow.
 * `index` staggers cards of one grid (capped in CSS).
 */
export default function Reveal({ variant = "rise", index = 0, className = "", children }: { variant?: RevealVariant; index?: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
      node.setAttribute("data-in", "");
      return;
    }
    node.setAttribute("data-armed", ""); // the script is running: cancels the CSS fail-safe
    const io = getObserver();
    io.observe(node);
    return () => io.unobserve(node);
  }, []);
  return (
    <div ref={ref} data-reveal={variant} style={{ "--i": Math.min(index, 6) } as React.CSSProperties} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
