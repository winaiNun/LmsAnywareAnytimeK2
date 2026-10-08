/* eslint-disable @next/next/no-img-element */
import type { SiteInfo } from "@/lib/site";
import HeroVideo from "./hero-video";

/** Full-width identity banner: logo, system name, district, over a fading video. */
export default function SiteHero({ site }: { site: SiteInfo }) {
  const logoAlt = `โลโก้ ${site.systemName}`;

  return (
    <section
      aria-label={site.systemName}
      className="relative flex min-h-[460px] w-full items-center justify-center overflow-hidden px-4 pb-16 pt-28 text-center text-white sm:min-h-[580px]"
      style={{ backgroundColor: site.heroBgColor }}
    >
      {site.heroVideoUrl ? <HeroVideo src={site.heroVideoUrl} fadeSeconds={site.fadeSeconds} /> : <div className="hero-aurora absolute inset-0" />}
      <div className="absolute inset-0 bg-black" style={{ opacity: site.overlayOpacity / 100 }} />

      <div className="relative flex max-w-3xl flex-col items-center gap-5 [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">
        {site.logoUrl &&
          (site.logoBackdrop ? (
            // Opaque logos (e.g. JPG with a white background) sit on a plate so they look intentional.
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white/95 p-3 shadow-xl sm:h-36 sm:w-36">
              <img src={site.logoUrl} alt={logoAlt} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            // Transparent logos float straight over the video; a soft shadow keeps them legible.
            <img
              src={site.logoUrl}
              alt={logoAlt}
              className="h-32 w-auto max-w-[280px] object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)] sm:h-44 sm:max-w-[360px]"
            />
          ))}
        <h1 className="text-balance text-4xl font-bold leading-tight sm:text-6xl">{site.systemName}</h1>
        {site.areaName && <p className="text-balance text-xl font-medium sm:text-3xl">{site.areaName}</p>}
        {site.tagline && <p className="text-balance text-base text-white/90 sm:text-lg">{site.tagline}</p>}
      </div>
    </section>
  );
}
