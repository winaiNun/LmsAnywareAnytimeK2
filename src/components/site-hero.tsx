/* eslint-disable @next/next/no-img-element */
import type { SiteInfo } from "@/lib/site";
import HeroGlobe from "./hero-globe";
import HeroVideo from "./hero-video";
import { getSiteTexts } from "@/lib/site-texts-server";
import { plainText } from "@/lib/site-texts";
import Lines from "./lines";

/** Full-width identity banner: logo, system name, district, over a picture, GIF or fading video. */
export default async function SiteHero({ site }: { site: SiteInfo }) {
  const texts = site.heroGlobe ? await getSiteTexts() : null;
  const logoAlt = `โลโก้ ${plainText(site.systemName)}`;

  return (
    <section
      aria-label={plainText(site.systemName)}
      className="relative flex min-h-[460px] w-full items-center justify-center overflow-hidden px-4 pb-16 pt-28 text-center text-white sm:min-h-[580px]"
      style={{ backgroundColor: site.heroBgColor }}
    >
      {site.heroImageUrl ? (
        // Animated pictures hide under "reduce motion" (an <img> cannot be paused), leaving the solid hero colour.
        <img src={site.heroImageUrl} alt="" aria-hidden fetchPriority="high" className={`absolute inset-0 h-full w-full object-cover ${site.heroImageAnimated ? "motion-reduce:hidden" : ""}`} />
      ) : site.heroVideoUrl ? (
        <HeroVideo src={site.heroVideoUrl} fadeSeconds={site.fadeSeconds} />
      ) : (
        <div className="hero-aurora absolute inset-0" />
      )}
      <div className="absolute inset-0 bg-black" style={{ opacity: site.overlayOpacity / 100 }} />
      {texts && <HeroGlobe pauseLabel={texts["hero.animPause"]} playLabel={texts["hero.animPlay"]} strength={site.heroGlobeStrength} />}

      <div className="relative z-10 flex max-w-3xl flex-col items-center gap-5 [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">
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
        <h1 className="text-balance text-4xl font-bold leading-tight sm:text-6xl">
          <Lines text={site.systemNameRaw} />
        </h1>
        {/* One line always: the size follows the screen width instead of wrapping. */}
        {site.areaName && <p className="whitespace-nowrap text-[clamp(0.7rem,3.6vw,1.875rem)] font-medium">{plainText(site.areaNameRaw)}</p>}
        {site.tagline && (
          <p className="text-balance text-base text-white/90 sm:text-lg">
            <Lines text={site.taglineRaw} />
          </p>
        )}
      </div>
    </section>
  );
}
