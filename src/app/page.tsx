import Link from "next/link";
import SiteNavbar from "@/components/site-navbar";
import BannerCarousel from "@/components/banner-carousel";
import SiteHero from "@/components/site-hero";
import { getActiveBanners, getSlideshowConfig, orderForDisplay } from "@/lib/banners";
import { db } from "@/lib/db";
import { HEADING_ALIGN, HEADING_SIZE, sectionBackground } from "@/lib/section-styles";
import { getHomeSections, type HomeSectionConfig } from "@/lib/sections";
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
  const [site, sections, banners, slideshow, categories, books, courses] = await Promise.all([
    getSiteInfo(),
    getHomeSections(),
    getActiveBanners(),
    getSlideshowConfig(),
    db.category.findMany({ include: { _count: { select: { books: true } } }, orderBy: { name: "asc" }, take: 4 }),
    db.book.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { authors: { include: { author: true } } } }),
    db.course.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take: 3, include: { _count: { select: { lessons: true, enrollments: true } } } }),
  ]);

  const content: Record<string, React.ReactNode> = {
    recommended: banners.length > 0 && <BannerCarousel banners={orderForDisplay(banners, slideshow.shuffle)} config={slideshow} />,
    categories: (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {categories.map((c) => (
          <div key={c.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-3 h-10 w-10 rounded-full" style={{ backgroundColor: colorOf(c.id), opacity: 0.18 }} />
            <p className="text-lg font-semibold text-neutral-900">{c.name}</p>
            <p className="text-sm text-neutral-500">{c._count.books} รายการ</p>
          </div>
        ))}
      </div>
    ),
    media: (
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {books.map((b) => (
          <div key={b.id} className="space-y-2">
            <div className="flex aspect-[3/4] items-end rounded-xl p-3 text-sm font-bold leading-snug text-white" style={{ backgroundColor: colorOf(b.id) }}>{b.title}</div>
            <p className="font-semibold leading-snug">{b.title}</p>
            <p className="text-sm opacity-70">{b.authors.map((a) => a.author.name).join(", ") || "—"}</p>
          </div>
        ))}
      </div>
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
  };
  const anchors: Record<string, string> = { media: "media", courses: "courses" };

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
