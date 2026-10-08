"use client";

import { useEffect, useRef } from "react";

/**
 * Looping muted background video that fades in at the start and out at the end of
 * every loop, so the restart is a soft dissolve into the hero colour behind it.
 */
export default function HeroVideo({ src, fadeSeconds }: { src: string; fadeSeconds: number }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Respect "reduce motion": keep the solid hero colour, no moving background.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      video.style.display = "none";
      return;
    }

    let raf = 0;
    const tick = () => {
      const d = video.duration;
      if (Number.isFinite(d) && d > 0) {
        const f = Math.min(fadeSeconds, d / 2);
        const t = video.currentTime;
        const o = f > 0 ? Math.min(t / f, (d - t) / f, 1) : 1;
        video.style.opacity = String(Math.max(0, o));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    video.play().catch(() => {});
    return () => cancelAnimationFrame(raf);
  }, [fadeSeconds, src]);

  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-hidden
      tabIndex={-1}
      className="absolute inset-0 h-full w-full object-cover"
      style={{ opacity: 0 }}
    />
  );
}
