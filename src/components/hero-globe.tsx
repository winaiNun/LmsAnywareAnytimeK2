"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fibonacciSphere, nearestEdges, pointCountFor, project, rotate, type P3 } from "@/lib/hero-globe";

const STORAGE_KEY = "lms.heroAnim"; // "off" = the visitor stopped the animation
const DOT_COLORS = ["#FFFFFF", "#CFE2FF", "#8DB8FF", "#5B9BFF", "#FFB36B"]; // white, ice, sky, blue, a little amber
const SPIN = 0.00012; // radians per millisecond (one turn in about a minute)
const FOLLOW = 0.045; // how quickly the globe leans towards the pointer (0..1 per frame)

const read = (): "on" | "off" | null => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
};

/**
 * A slowly turning globe of dots and lines drawn on a canvas over the home banner. It leans and drifts towards the pointer
 * and lights the lines near it. It only runs while the banner is on screen and the tab is visible, uses fewer points on a phone,
 * and shows one still picture (no motion) when the visitor asks for reduced motion or presses the stop button.
 */
export default function HeroGlobe({ pauseLabel, playLabel, strength = 100 }: { pauseLabel: string; playLabel: string; strength?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(true);
  playingRef.current = playing;
  // kept outside the effect so pressing stop/play does not make the globe jump back to its starting angle
  const rotRef = useRef({ ay: 0.6, ax: 0.18, lean: { x: 0, y: 0 }, tx: 0, ty: 0 });

  // the visitor's own choice wins; otherwise "reduce motion" starts it stopped
  useEffect(() => {
    const saved = read();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPlaying(saved ? saved === "on" : !reduce);
  }, []);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, p ? "off" : "on");
      } catch {}
      return !p;
    });
  }, []);

  useEffect(() => {
    const box = wrap.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!box || !cv || !ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let points: P3[] = [];
    let edges: [number, number][] = [];
    let sizes: number[] = [];
    let colors: string[] = [];
    let visible = true;
    let raf = 0;
    let last = performance.now();
    const rot = rotRef.current;
    const mouse = { x: 0, y: 0, nx: 0.5, ny: 0.5, near: false };

    const build = () => {
      points = fibonacciSphere(pointCountFor(w));
      edges = nearestEdges(points, 3);
      sizes = points.map((_, i) => 1.1 + ((i * 7919) % 100) / 100 * 1.9);
      colors = points.map((_, i) => DOT_COLORS[(i * 2654435761) % DOT_COLORS.length | 0]);
    };

    const resize = () => {
      const r = box.getBoundingClientRect();
      const nw = Math.max(1, Math.round(r.width));
      const nh = Math.max(1, Math.round(r.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      if (nw !== w || nh !== h) {
        const rebuild = pointCountFor(nw) !== pointCountFor(w);
        w = nw;
        h = nh;
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        if (rebuild || !points.length) build();
      }
      draw();
    };

    function draw() {
      if (!w || !points.length) return;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      const radius = Math.min(w * 0.62, h * 0.7);
      const cx = w / 2 + rot.lean.y * w * 0.06;
      const cy = h / 2 - rot.lean.x * h * 0.08; // drifts the same way the face tips: towards the pointer

      // a deep-blue haze behind the globe: it lifts the dots off a busy picture and keeps the title readable
      const haze = ctx!.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 1.15);
      haze.addColorStop(0, "rgba(6,26,84,0.42)");
      haze.addColorStop(0.7, "rgba(6,26,84,0.18)");
      haze.addColorStop(1, "rgba(6,26,84,0)");
      ctx!.fillStyle = haze;
      ctx!.fillRect(0, 0, w, h);

      // a soft light that follows the pointer
      if (mouse.near && playingRef.current) {
        const g = ctx!.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, Math.min(w, 420) * 0.55);
        g.addColorStop(0, "rgba(120,170,255,0.20)");
        g.addColorStop(1, "rgba(120,170,255,0)");
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, w, h);
      }

      const proj = points.map((p) => project(rotate(p, rot.ax + rot.lean.x, rot.ay + rot.lean.y), cx, cy, radius));

      ctx!.lineCap = "round";
      for (const [a, b] of edges) {
        const pa = proj[a];
        const pb = proj[b];
        const depth = (pa.depth + pb.depth) / 2;
        let alpha = 0.14 + depth * 0.34;
        if (mouse.near && playingRef.current) {
          const d = Math.hypot((pa.x + pb.x) / 2 - mouse.x, (pa.y + pb.y) / 2 - mouse.y);
          if (d < 190) alpha += (1 - d / 190) * 0.5;
        }
        ctx!.beginPath();
        ctx!.moveTo(pa.x, pa.y);
        ctx!.lineTo(pb.x, pb.y);
        ctx!.strokeStyle = `rgba(4,22,70,${(Math.min(0.5, alpha) * 0.6).toFixed(3)})`; // thin dark edge: the line shows on light and dark pictures
        ctx!.lineWidth = 2.6;
        ctx!.stroke();
        ctx!.strokeStyle = `rgba(190,215,255,${Math.min(0.95, alpha + 0.12).toFixed(3)})`;
        ctx!.lineWidth = 1.2;
        ctx!.stroke();
      }

      // far dots first, near dots on top
      const order = proj.map((_, i) => i).sort((i, j) => proj[i].depth - proj[j].depth);
      for (const i of order) {
        const p = proj[i];
        const r = sizes[i] * p.scale * 1.25;
        ctx!.globalAlpha = 0.45 + p.depth * 0.55;
        ctx!.fillStyle = "rgba(4,22,70,0.45)"; // halo
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r + 1.6, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = colors[i];
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || !playingRef.current) return;
      const dt = Math.min(50, now - last);
      last = now;
      rot.ay += dt * SPIN;
      rot.lean.x += (rot.tx - rot.lean.x) * FOLLOW;
      rot.lean.y += (rot.ty - rot.lean.y) * FOLLOW;
      draw();
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf || !visible || document.hidden || !playingRef.current) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const r = box.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      mouse.near = inside;
      if (inside) {
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        mouse.nx = mouse.x / r.width;
        mouse.ny = mouse.y / r.height;
      } else {
        mouse.nx = 0.5;
        mouse.ny = 0.5;
      }
      rot.ty = (mouse.nx - 0.5) * 0.9; // turn towards the side the pointer is on
      rot.tx = -(mouse.ny - 0.5) * 0.5; // tip the near side down when the pointer is low, up when it is high (screen y points down)
    };
    const onLeave = () => {
      mouse.near = false;
      rot.tx = 0;
      rot.ty = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(box);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    io.observe(box);
    const onVisibility = () => {
      if (!document.hidden) start();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    start();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [playing]);

  return (
    <div ref={wrap} className="pointer-events-none absolute inset-0 z-[1]">
      <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" style={{ opacity: Math.min(100, Math.max(20, strength)) / 100 }} />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? pauseLabel : playLabel}
        title={playing ? pauseLabel : playLabel}
        className="pointer-events-auto absolute bottom-[4.5rem] right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
          {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" />}
        </svg>
      </button>
    </div>
  );
}
