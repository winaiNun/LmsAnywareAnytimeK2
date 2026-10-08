"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { PublicBanner } from "@/lib/banners";
import { DEFAULT_SLIDESHOW, EFFECT_VALUES, isExternalUrl, type SlideEffect, type SlideshowConfig } from "@/lib/slideshow";

const DURATION = 800; // ms, every transition effect
const EASE = "cubic-bezier(0.22, 0.8, 0.2, 1)";

type Props = {
  banners: PublicBanner[];
  config?: SlideshowConfig;
  /** Admin preview: links are inert. */
  preview?: boolean;
};

type ZoomState = "active" | "prev" | "idle" | false;

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={dir === "left" ? "M14.5 5.5 8 12l6.5 6.5" : "M9.5 5.5 16 12l-6.5 6.5"} />
  </svg>
);

/** A random effect that differs from `not`, so consecutive changes never repeat. */
const randomEffect = (not?: SlideEffect): SlideEffect => {
  const pool = EFFECT_VALUES.filter((e) => e !== not);
  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Recommended courses / media slideshow. Every slide is stacked, so any of the five effects (or a
 * random mix of them) can be used; "slide" follows the finger while swiping. Hovering pauses the
 * timer and the progress bar, and the countdown resumes where it stopped.
 */
export default function BannerCarousel({ banners, config = DEFAULT_SLIDESHOW, preview = false }: Props) {
  const count = banners.length;
  const { radius, layout, arrows, intervalSec, randomEffect: random } = config;
  const interval = Math.max(2, intervalSec) * 1000;

  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  // The effect used by the change in progress, and the one the next change will use. Idle slides are
  // parked in the "next" effect's hidden pose, so they animate in correctly when their turn comes.
  const [effectNow, setEffectNow] = useState<SlideEffect>(config.effect);
  const [effectNext, setEffectNext] = useState<SlideEffect>(config.effect);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const viewRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; t: number; id: number; active: boolean } | null>(null);
  const moved = useRef(false);
  const clearPrev = useRef<ReturnType<typeof setTimeout>>();
  // countdown bookkeeping so hover can pause and later resume with the time that was left
  const remaining = useRef(interval);
  const startedAt = useRef(0);

  // follow admin changes (live preview) and keep the index valid when slides disappear
  useEffect(() => {
    setEffectNow(config.effect);
    setEffectNext(random ? randomEffect(config.effect) : config.effect);
  }, [config.effect, random]);
  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduced(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    const vis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      mq.removeEventListener("change", upd);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const go = useCallback(
    (to: number, direction?: 1 | -1) => {
      if (count < 2) return;
      const next = ((to % count) + count) % count;
      if (next === index) return;
      setDir(direction ?? (to > index ? 1 : -1));
      setPrevIndex(index);
      setIndex(next);
      setEffectNow(effectNext);
      setEffectNext(random ? randomEffect(effectNext) : config.effect);
      clearTimeout(clearPrev.current);
      clearPrev.current = setTimeout(() => setPrevIndex(null), DURATION + 100);
    },
    [count, index, effectNext, random, config.effect],
  );

  const paused = hover || focused || hidden || dragging || reduced;
  const autoplay = config.autoplay && count > 1;
  const running = autoplay && !paused;

  // a new slide always gets a full countdown
  useEffect(() => {
    remaining.current = interval;
  }, [index, interval]);

  useEffect(() => {
    if (!running) return;
    startedAt.current = performance.now();
    const t = setTimeout(() => go(index + 1, 1), remaining.current);
    return () => {
      clearTimeout(t);
      // paused mid-way: remember how much time is left
      remaining.current = Math.max(400, remaining.current - (performance.now() - startedAt.current));
    };
  }, [running, index, go]);

  useEffect(() => () => clearTimeout(clearPrev.current), []);

  // ---- swipe / drag ------------------------------------------------------------------
  function onPointerDown(e: React.PointerEvent) {
    if (count < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag.current = { x: e.clientX, t: performance.now(), id: e.pointerId, active: false };
    moved.current = false;
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.active && Math.abs(dx) > 8) {
      d.active = true;
      setDragging(true);
      try { viewRef.current?.setPointerCapture(d.id); } catch { /* pointer already gone */ }
    }
    if (d.active) {
      moved.current = true;
      setDragX(dx);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    const dx = e.clientX - d.x;
    const speed = Math.abs(dx) / Math.max(1, performance.now() - d.t); // px per ms
    const width = viewRef.current?.clientWidth ?? 1;
    setDragging(false);
    setDragX(0);
    if (Math.abs(dx) > width * 0.15 || speed > 0.45) {
      if (dx < 0) go(index + 1, 1);
      else go(index - 1, -1);
    }
    setTimeout(() => { moved.current = false; }, 0); // swallow the click that ends a drag
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1, -1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1, 1); }
  }

  if (count === 0) return null;

  const stateOf = (i: number) => (i === index ? "active" : i === prevIndex ? "prev" : "idle");

  /** Position/visibility of one stacked slide for the current effect. */
  function stackStyle(i: number): CSSProperties {
    const st = stateOf(i);
    const shown = st !== "idle";
    const base: CSSProperties = { position: "absolute", inset: 0, zIndex: st === "active" ? 2 : st === "prev" ? 1 : 0 };
    const eff = st === "idle" ? effectNext : effectNow;
    const anim = reduced ? "opacity 200ms linear" : `all ${DURATION}ms ${EASE}`;
    // idle slides snap into place without animating; active/prev animate
    const transition = st === "idle" ? "none" : anim;

    if (reduced || eff === "fade" || eff === "zoom") {
      return { ...base, opacity: shown ? 1 : 0, visibility: shown ? "visible" : "hidden", transition };
    }
    if (eff === "wipe") {
      return { ...base, clipPath: shown ? "inset(0 0 0 0)" : "inset(0 0 0 100%)", visibility: shown ? "visible" : "hidden", transition };
    }
    if (eff === "blur") {
      return { ...base, opacity: shown ? 1 : 0, transform: shown ? "scale(1)" : "scale(1.08)", filter: shown ? "blur(0)" : "blur(12px)", visibility: shown ? "visible" : "hidden", transition };
    }

    // slide: live finger-follow while dragging, otherwise travel in the swipe direction
    const next = (index + 1) % count;
    const before = (index - 1 + count) % count;
    let x = 0;
    let tr = transition;
    if (dragging && dragX !== 0) {
      tr = "none";
      if (st === "active") x = dragX;
      else if (dragX < 0 && i === next) x = 100;
      else if (dragX > 0 && i === before) x = -100;
      else return { ...base, visibility: "hidden", transform: "translateX(100%)", transition: "none" };
      const px = st === "active" ? `${x}px` : `calc(${x}% + ${dragX}px)`;
      return { ...base, transform: `translateX(${px})`, visibility: "visible", transition: tr };
    }
    if (st === "active") x = 0;
    else if (st === "prev") x = dir > 0 ? -100 : 100; // leaves the opposite way it came
    else x = i === before && count > 2 ? -100 : 100; // idle: parked on the side it will arrive from
    return { ...base, transform: `translateX(${x}%)`, visibility: shown || x === 0 ? "visible" : "hidden", transition: tr };
  }

  const zoomOf = (i: number): ZoomState => {
    if (effectNow !== "zoom" || reduced) return false;
    return stateOf(i);
  };

  const rounded = layout === "full" ? 0 : radius;
  const showArrows = arrows && count > 1;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="คอร์สและสื่อแนะนำ"
      data-effect={effectNow}
      data-paused={paused ? "true" : "false"}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}
      className="group/slides relative w-full select-none overflow-hidden bg-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-brand"
      style={{ borderRadius: rounded }}
    >
      <div
        ref={viewRef}
        className="relative aspect-[3/1] w-full cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
        style={{ borderRadius: rounded }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {banners.map((b, i) => (
          <div key={b.id} style={stackStyle(i)}>
            <Slide banner={b} active={i === index} preview={preview} moved={moved} zoom={zoomOf(i)} intervalSec={intervalSec} />
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          {showArrows && (
            <>
              <button
                type="button"
                aria-label="สไลด์ก่อนหน้า"
                onClick={() => go(index - 1, -1)}
                className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-x-3 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white opacity-0 shadow-lg ring-1 ring-white/30 backdrop-blur-md transition duration-300 hover:bg-black/50 focus-visible:translate-x-0 focus-visible:opacity-100 group-hover/slides:translate-x-0 group-hover/slides:opacity-100 [@media(hover:none)]:hidden"
              >
                <Chevron dir="left" />
              </button>
              <button
                type="button"
                aria-label="สไลด์ถัดไป"
                onClick={() => go(index + 1, 1)}
                className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 translate-x-3 items-center justify-center rounded-full bg-black/30 text-white opacity-0 shadow-lg ring-1 ring-white/30 backdrop-blur-md transition duration-300 hover:bg-black/50 focus-visible:translate-x-0 focus-visible:opacity-100 group-hover/slides:translate-x-0 group-hover/slides:opacity-100 [@media(hover:none)]:hidden"
              >
                <Chevron dir="right" />
              </button>
            </>
          )}

          {/* progress pills: the active one fills over the slide interval and freezes while paused */}
          <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center sm:bottom-3">
            <div className="flex items-center rounded-full bg-black/25 px-1.5 py-0.5 backdrop-blur-md">
              {banners.map((b, i) => (
                <button key={b.id} type="button" aria-label={`ไปที่สไลด์ ${i + 1}`} aria-current={i === index} onClick={() => go(i)} className="flex h-6 items-center px-[3px]">
                  <span className={`relative block h-1.5 overflow-hidden rounded-full bg-white/45 transition-all duration-500 ${i === index ? "w-8" : "w-1.5"}`}>
                    {i === index && (
                      <span
                        key={index}
                        className="absolute inset-y-0 left-0 block rounded-full bg-white"
                        style={autoplay ? { animation: `slide-progress ${interval}ms linear forwards`, animationPlayState: paused ? "paused" : "running" } : { width: "100%" }}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {paused && autoplay && hover && (
            <span className="pointer-events-none absolute right-4 top-3 z-10 hidden items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md sm:flex" aria-hidden>
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
              หยุดชั่วคราว
            </span>
          )}

          <p className="pointer-events-none absolute bottom-3 right-4 z-10 hidden rounded-full bg-black/25 px-3 py-0.5 text-xs font-medium tabular-nums text-white backdrop-blur-md sm:block" aria-hidden>
            {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </p>
          <span className="sr-only" aria-live="polite">สไลด์ที่ {index + 1} จาก {count}</span>
        </>
      )}
    </section>
  );
}

function Slide({ banner: b, active, preview, moved, zoom, intervalSec }: { banner: PublicBanner; active: boolean; preview: boolean; moved: React.MutableRefObject<boolean>; zoom: ZoomState; intervalSec: number }) {
  const external = isExternalUrl(b.linkUrl);
  const newTab = b.newTab || external;

  const content = (
    <>
      {b.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={b.imageUrl}
          alt={b.showText ? "" : b.title}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={
            zoom
              ? zoom === "idle"
                ? { transform: "scale(1)", transition: "none" }
                : { transform: "scale(1.09)", transition: zoom === "active" ? `transform ${(intervalSec + 1.5).toFixed(1)}s linear` : "none" }
              : undefined
          }
        />
      )}
      {b.imageUrl && b.showText && <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />}
      {b.showText && (
        <div className={`relative flex h-full max-w-[72%] flex-col justify-center gap-1 px-4 sm:max-w-md sm:gap-3 sm:px-10 ${b.imageUrl ? "text-white" : "text-neutral-900"}`}>
          {[
            <h2 key="t" className="text-balance text-lg font-bold leading-tight sm:text-3xl">{b.title}</h2>,
            b.subtitle ? <p key="s" className={`line-clamp-2 text-sm sm:text-base ${b.imageUrl ? "text-white/90" : "text-neutral-600"}`}>{b.subtitle}</p> : null,
            b.linkUrl ? (
              <span key="b" className="mt-1 inline-flex min-h-9 w-fit items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white shadow-lg sm:min-h-11 sm:px-6">
                {b.buttonText || "ดูรายละเอียด"}
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={external ? "M7 17 17 7M8 7h9v9" : "M5 12h14M13 6l6 6-6 6"} />
                </svg>
              </span>
            ) : null,
          ]
            .filter(Boolean)
            .map((el, n) => (
              <div key={n} style={{ opacity: active ? 1 : 0, transform: active ? "none" : "translateY(14px)", transition: "opacity 700ms ease, transform 700ms ease", transitionDelay: active ? `${250 + n * 120}ms` : "0ms" }}>
                {el}
              </div>
            ))}
        </div>
      )}
    </>
  );

  const frame = "absolute inset-0 flex items-center";
  const style = { backgroundColor: b.bgColor };

  if (!b.linkUrl || preview) {
    return <div className={frame} style={style} aria-hidden={!active}>{content}</div>;
  }
  const guard = (e: React.MouseEvent) => { if (moved.current) e.preventDefault(); };
  if (external) {
    return (
      <a href={b.linkUrl} target={newTab ? "_blank" : undefined} rel="noopener noreferrer" aria-label={b.title} aria-hidden={!active} tabIndex={active ? 0 : -1} onClick={guard} draggable={false} className={frame} style={style}>
        {content}
      </a>
    );
  }
  return (
    <Link href={b.linkUrl} target={newTab ? "_blank" : undefined} aria-label={b.title} aria-hidden={!active} tabIndex={active ? 0 : -1} onClick={guard} draggable={false} className={frame} style={style}>
      {content}
    </Link>
  );
}
