import Link from "next/link";
import CourseCard from "@/components/course-card";
import SiteNavbar from "@/components/site-navbar";
import BannerCarousel from "@/components/banner-carousel";
import Glyph, { IconTile } from "@/components/glyph";
import MediaCard from "@/components/media-card";
import MediaRail, { RAIL_ITEM } from "@/components/media-rail";
import CenterGrid from "@/components/center-grid";
import NewsSection from "@/components/news/news-section";
import StatCards from "@/components/stat-cards";
import ResourceCard from "@/components/resource-card";
import SchoolCard from "@/components/school-card";
import SiteHero from "@/components/site-hero";
import { getActiveBanners, getSlideshowConfig, orderForDisplay } from "@/lib/banners";
import { latestCourses } from "@/lib/course/course-data";
import { db } from "@/lib/db";
import { areaCounts, latestMedia, popularMedia } from "@/lib/media-list";
import SectionHeading from "@/components/section-heading";
import { sectionBackground } from "@/lib/section-styles";
import HonorCard from "@/components/honor-card";
import HonorsMarquee from "@/components/honors-marquee";
import Lines from "@/components/lines";
import Reveal from "@/components/reveal";
import { getHonorsForHome } from "@/lib/honors";
import { getHomeSections, type HomeSectionConfig } from "@/lib/sections";
import { countPublicSchools, getRandomSchools } from "@/lib/schools";
import { resourceImageOf } from "@/lib/resource-image";
import { getSiteInfo } from "@/lib/site";
import { getNewsPage, getNewsTabs, withTimeout } from "@/lib/news/data";
import { getStatCards } from "@/lib/stats/data";
import { getSiteTexts } from "@/lib/site-texts-server";

export const dynamic = "force-dynamic";

/** One home-page block: full-width background, centered content, styled heading. */
// moreBelow: the block draws its own "see all" button at the bottom (the news block), so the heading does not
function Block({ cfg, anchor, bleed = false, alt = false, moreBelow = false, selfReveal = false, children }: { cfg: HomeSectionConfig; anchor?: string; bleed?: boolean; alt?: boolean; moreBelow?: boolean; selfReveal?: boolean; children: React.ReactNode }) {
  const bg = sectionBackground({ mode: cfg.bgMode, color: cfg.bgColor, color2: cfg.bgColor2, direction: cfg.bgDirection, imageUrl: cfg.bgImageUrl, overlay: cfg.bgOverlay });
  return (
    <section
      id={anchor}
      aria-labelledby={`sec-${cfg.key}`}
      className={`relative scroll-mt-16 py-12 sm:py-14 ${bg.tone === "light" ? "text-white" : ""} ${alt && cfg.bgMode === "none" ? "bg-[#EEF3FF]/70" : ""}`}
      style={bg.style}
    >
      {bg.overlay > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bg.overlay / 100 }} aria-hidden />}
      <div className="relative mx-auto max-w-6xl space-y-6 px-4">
        <Reveal>
        <SectionHeading
          id={`sec-${cfg.key}`}
          style={cfg.headingStyle}
          title={cfg.title}
          subtitle={cfg.subtitle}
          eyebrow={cfg.eyebrow}
          accent={cfg.accentColor}
          align={cfg.align}
          size={cfg.titleSize}
          titleColor={cfg.titleColor}
          moreHref={moreBelow ? null : cfg.moreHref}
          icon={cfg.icon}
          onDark={bg.tone === "light"}
        />
        </Reveal>
        {!bleed && (selfReveal ? children : <Reveal>{children}</Reveal>)}
      </div>
      {/* edge-to-edge content (full-width slideshow) sits outside the centred container */}
      {bleed && <div className="relative mt-6"><Reveal variant="fade">{children}</Reveal></div>}
    </section>
  );
}

/**
 * The news tabs and, when it is ready within 2.5 s (it is almost always cached), the first page of the first tab. If a feed is slow
 * the page does not wait: the block starts with a loading frame and the browser asks /api/news itself.
 */
async function loadNews() {
  const tabs = await getNewsTabs();
  if (tabs.length === 0) return null;
  const initial = await withTimeout(getNewsPage(tabs[0].id, 1), 2500).catch(() => null);
  return { tabs: tabs.map((t) => ({ id: t.id, name: t.name, pageSize: t.pageSize })), initial };
}

export default async function HomePage() {
  const [site, sections, banners, slideshow, courses, schools, schoolTotal, areas, latest, popular, honors, resources, news, texts, stats] = await Promise.all([
    getSiteInfo(),
    getHomeSections(),
    getActiveBanners(),
    getSlideshowConfig(),
    latestCourses(6),
    getRandomSchools(), // 12 = 4 columns × 3 rows, different on every visit
    countPublicSchools(),
    areaCounts(),
    latestMedia(12),
    popularMedia(12),
    getHonorsForHome(12),
    db.resourceLink.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 6 }),
    loadNews().catch(() => null), // a failing news block must never take the home page down
    getSiteTexts(),
    getStatCards().catch(() => []), // a failing count must never take the home page down
  ]);

  const content: Record<string, React.ReactNode> = {
    recommended: banners.length > 0 && <BannerCarousel banners={orderForDisplay(banners, slideshow.shuffle)} config={slideshow} />,
    areas: (
      <CenterGrid
        variant="areas"
        items={areas.map((a) => ({
          key: a.id,
          node: (
            <Link
              href={`/library?area=${a.slug}`}
              style={{ "--c": a.color } as React.CSSProperties}
              className="group relative flex h-full min-h-[5.5rem] items-center gap-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--c)] hover:shadow-[0_14px_30px_-14px_var(--c)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand sm:flex-col sm:items-start sm:gap-2 sm:p-4"
            >
              <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ backgroundColor: `${a.color}14` }} aria-hidden />
              <IconTile name={a.icon} color={a.color} size={46} className="transition group-hover:scale-105" />
              <span className="min-w-0">
                <span className="block whitespace-pre-line text-sm font-semibold leading-snug text-neutral-900 [text-wrap:balance]">{a.cardName ?? a.name}</span>
                <span className="block text-xs text-neutral-500">{a.count.toLocaleString("th-TH")} สื่อ</span>
              </span>
              <Glyph name="chevron-right" size={16} strokeWidth={2.2} className="absolute bottom-3 right-3 hidden -translate-x-1 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 sm:block" />
            </Link>
          ),
        }))}
      />
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
    honors: honors.length > 0 && (
      <div className="space-y-4">
        {honors.length >= 5 ? (
          <HonorsMarquee pauseLabel={texts["hero.animPause"]} playLabel={texts["hero.animPlay"]}>
            {honors.map((m) => <HonorCard key={m.id} m={m} compact />)}
          </HonorsMarquee>
        ) : (
          <ul className="flex flex-wrap justify-center gap-4">{honors.map((m) => <li key={m.id} className="w-56 sm:w-60"><HonorCard m={m} compact /></li>)}</ul>
        )}
        <p className="mx-auto max-w-2xl text-center text-sm text-neutral-600"><Lines text={texts["honors.invite"]} /></p>
      </div>
    ),
    courses: courses.length > 0 && (
      <CenterGrid variant="courses" items={courses.map((c) => ({ key: c.id, node: <CourseCard course={c} /> }))} />
    ),
    schools:
      schools.length > 0 && (
        <div className="space-y-6">
          <CenterGrid variant="schools" items={schools.map((sc) => ({ key: sc.id, node: <SchoolCard school={sc} /> }))} />
          <div className="flex justify-center">
            <Link href="/schools" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-7 font-semibold text-white shadow-sm hover:bg-brand-dark">
              ดูข้อมูลทั้งหมด ({schoolTotal.toLocaleString("th-TH")} โรงเรียน)
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </div>
        </div>
      ),
    news: !!news && !(news.tabs.length === 1 && news.initial && news.initial.total === 0) && (
      <NewsSection tabs={news.tabs} initial={news.initial} moreHref={sections.find((x) => x.key === "news")?.moreHref ?? null} texts={{ empty: texts["news.empty"], sourceError: texts["news.sourceError"], tabsLabel: "หัวข้อข่าว", more: texts["news.more"] }} />
    ),
    resources: resources.length > 0 && (
      <CenterGrid variant="resources" items={resources.map((r) => ({ key: r.id, node: <ResourceCard r={{ ...r, image: resourceImageOf(r) }} /> }))} />
    ),
  };
  const anchors: Record<string, string> = { news: "news", areas: "areas", latest: "latest", popular: "popular", courses: "courses", honors: "honors", schools: "schools", resources: "resources" };

  return (
    <>
      <SiteNavbar />
      <SiteHero site={site} />
      <StatCards cards={stats} regionLabel={texts["stats.regionLabel"]} />
      {sections
        .filter((s) => s.visible && content[s.key])
        .map((s, i) => (
          <Block key={s.key} cfg={s} anchor={anchors[s.key]} alt={i % 2 === 1} bleed={s.key === "recommended" && slideshow.layout === "full"} moreBelow={s.key === "news"} selfReveal={["areas", "courses", "schools", "resources"].includes(s.key)}>
            {content[s.key]}
          </Block>
        ))}
    </>
  );
}
