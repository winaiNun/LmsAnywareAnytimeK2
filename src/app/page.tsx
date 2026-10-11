import Link from "next/link";
import SiteNavbar from "@/components/site-navbar";
import BannerCarousel from "@/components/banner-carousel";
import { IconTile } from "@/components/glyph";
import MediaCard from "@/components/media-card";
import MediaRail, { RAIL_ITEM } from "@/components/media-rail";
import SchoolCard from "@/components/school-card";
import SiteHero from "@/components/site-hero";
import { getActiveBanners, getSlideshowConfig, orderForDisplay } from "@/lib/banners";
import { db } from "@/lib/db";
import { areaCounts, latestMedia, popularMedia } from "@/lib/media-list";
import { HEADING_ALIGN, HEADING_SIZE, sectionBackground } from "@/lib/section-styles";
import { getHomeSections, type HomeSectionConfig } from "@/lib/sections";
import { countPublicSchools, getRandomSchools } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";

export const dynamic = "force-dynamic";

const PALETTE = ["#1E3A8A", "#0F766E", "#9F1239", "#475569", "#7C3AED", "#B45309"];
const colorOf = (id: string) => PALETTE[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];

/** One home-page block: full-width background, centered content, styled heading. */
function Block({ cfg, anchor, bleed = false, children }: { cfg: HomeSectionConfig; anchor?: string; bleed?: boolean; children: React.ReactNode }) {
  const bg = sectionBackground({ mode: cfg.bgMode, color: cfg.bgColor, color2: cfg.bgColor2, direction: cfg.bgDirection, imageUrl: cfg.bgImageUrl, overlay: cfg.bgOverlay });
  return (
    <section
      id={anchor}
      aria-labelledby={`sec-${cfg.key}`}
      className={`relative scroll-mt-16 py-10 ${bg.tone === "light" ? "text-white" : ""}`}
      style={bg.style}
    >
      {bg.overlay > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bg.overlay / 100 }} aria-hidden />}
      <div className="relative mx-auto max-w-6xl space-y-6 px-4">
        <header className={HEADING_ALIGN[cfg.align]}>
          <h2 id={`sec-${cfg.key}`} className={`font-bold ${HEADING_SIZE[cfg.titleSize]}`} style={{ color: cfg.titleColor }}>
            {cfg.title}
          </h2>
          {cfg.subtitle && <p className="mt-1 opacity-80">{cfg.subtitle}</p>}
        </header>
        {!bleed && children}
      </div>
      {/* edge-to-edge content (full-width slideshow) sits outside the centred container */}
      {bleed && <div className="relative mt-6">{children}</div>}
    </section>
  );
}

export default async function HomePage() {
  const [site, sections, banners, slideshow, courses, schools, schoolTotal, areas, latest, popular] = await Promise.all([
    getSiteInfo(),
    getHomeSections(),
    getActiveBanners(),
    getSlideshowConfig(),
    db.course.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take: 3, include: { _count: { select: { lessons: true, enrollments: true } } } }),
    getRandomSchools(), // 12 = 4 columns × 3 rows, different on every visit
    countPublicSchools(),
    areaCounts(),
    latestMedia(12),
    popularMedia(12),
  ]);

  const content: Record<string, React.ReactNode> = {
    recommended: banners.length > 0 && <BannerCarousel banners={orderForDisplay(banners, slideshow.shuffle)} config={slideshow} />,
    areas: (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {areas.map((a) => (
          <li key={a.id}>
            <Link href={`/library?area=${a.slug}`} className="group flex h-full min-h-[5.5rem] items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand sm:flex-col sm:items-start sm:gap-2 sm:p-4">
              <IconTile name={a.icon} color={a.color} size={46} className="transition group-hover:scale-105" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug text-neutral-900">{a.name}</span>
                <span className="block text-xs text-neutral-500">{a.count.toLocaleString("th-TH")} สื่อ</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    ),
    latest: latest.length > 0 && (
      <MediaRail label="สื่อล่าสุด" moreHref="/library?sort=latest">
        {latest.map((c) => <li key={c.id} className={RAIL_ITEM}><MediaCard card={c} compact /></li>)}
      </MediaRail>
    ),
    popular: popular.length > 0 && (
      <MediaRail label="สื่อที่ถูกดูมากที่สุด" moreHref="/library?sort=views">
        {popular.map((c) => <li key={c.id} className={RAIL_ITEM}><MediaCard card={c} compact /></li>)}
      </MediaRail>
    ),
    courses: (
      <div className="grid gap-5 md:grid-cols-3">
        {courses.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="flex h-36 items-end p-4 text-lg font-bold text-white" style={{ backgroundColor: colorOf(c.id) }}>{c.title}</div>
            <div className="space-y-1 p-4">
              <p className="font-semibold text-neutral-900">{c.title}</p>
              <p className="text-sm text-neutral-500">{c._count.lessons} บทเรียน · {c._count.enrollments} ผู้เรียน</p>
            </div>
          </div>
        ))}
      </div>
    ),
    schools:
      schools.length > 0 && (
        <div className="space-y-6">
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {schools.map((s) => (
              <li key={s.id}>
                <SchoolCard school={s} />
              </li>
            ))}
          </ul>
          <div className="flex justify-center">
            <Link href="/schools" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-7 font-semibold text-white shadow-sm hover:bg-brand-dark">
              ดูข้อมูลทั้งหมด ({schoolTotal.toLocaleString("th-TH")} โรงเรียน)
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </div>
        </div>
      ),
  };
  const anchors: Record<string, string> = { areas: "areas", latest: "latest", popular: "popular", courses: "courses", schools: "schools" };

  return (
    <>
      <SiteNavbar />
      <SiteHero site={site} />
      {sections
        .filter((s) => s.visible && content[s.key])
        .map((s) => (
          <Block key={s.key} cfg={s} anchor={anchors[s.key]} bleed={s.key === "recommended" && slideshow.layout === "full"}>
            {content[s.key]}
          </Block>
        ))}

      <footer id="about" className="mt-10 border-t border-neutral-200 bg-gradient-to-b from-background to-brand-soft">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-neutral-500">
          <span>© 2026 {site.systemName}{site.areaName ? ` · ${site.areaName}` : ""}</span>
          <Link href="/login" className="hover:text-brand">เข้าสู่ระบบ</Link>
        </div>
      </footer>
      <div className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
    </>
  );
}
