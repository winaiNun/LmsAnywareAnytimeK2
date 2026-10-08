"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicBanner } from "@/lib/banners";

/** Recommended courses / media slideshow. Images are pre-cropped to 3:1 on upload. */
export default function BannerCarousel({ banners }: { banners: PublicBanner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [count, paused]);

  if (count === 0) return null;

  const go = (n: number) => setIndex((n + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="คอร์สและสื่อแนะนำ"
      className="relative w-full overflow-hidden rounded-2xl bg-white shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {banners.map((b, i) => {
          const body = (
            <>
              {b.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.imageUrl} alt={b.showText ? "" : b.title} className="absolute inset-0 h-full w-full object-cover" />
              )}
              {b.imageUrl && b.showText && (
                <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />
              )}
              {b.showText && (
                <div className={`relative max-w-[70%] space-y-1 px-4 sm:max-w-md sm:space-y-3 sm:px-10 ${b.imageUrl ? "text-white" : "text-neutral-900"}`}>
                  <h2 className="text-balance text-lg font-bold leading-tight sm:text-3xl">{b.title}</h2>
                  {b.subtitle && (
                    <p className={`line-clamp-2 text-sm sm:text-base ${b.imageUrl ? "text-white/90" : "text-neutral-600"}`}>{b.subtitle}</p>
                  )}
                  {b.linkUrl && (
                    <span className="mt-1 inline-flex min-h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white sm:min-h-11 sm:px-6">
                      {b.buttonText || "ดูรายละเอียด"}
                    </span>
                  )}
                </div>
              )}
            </>
          );
          const cls = "relative flex aspect-[3/1] w-full shrink-0 items-center";
          return (
            <article key={b.id} aria-hidden={i !== index} style={{ backgroundColor: b.bgColor }} className={cls}>
              {b.linkUrl ? (
                <Link href={b.linkUrl} tabIndex={i === index ? 0 : -1} aria-label={b.title} className="absolute inset-0 flex items-center">
                  {body}
                </Link>
              ) : (
                body
              )}
            </article>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button type="button" aria-label="ก่อนหน้า" onClick={() => go(index - 1)} className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-xl shadow hover:bg-white sm:flex">‹</button>
          <button type="button" aria-label="ถัดไป" onClick={() => go(index + 1)} className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-xl shadow hover:bg-white sm:flex">›</button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2">
            {banners.map((b, i) => (
              <button key={b.id} type="button" aria-label={`ไปที่สไลด์ ${i + 1}`} aria-current={i === index} onClick={() => go(i)} className="flex h-6 w-6 items-center justify-center">
                <span className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-brand" : "w-2 bg-white/90 ring-1 ring-black/10"}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
