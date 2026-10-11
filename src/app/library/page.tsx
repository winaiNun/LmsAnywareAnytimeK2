import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumb from "@/components/breadcrumb";
import Lines from "@/components/lines";
import { plainText } from "@/lib/site-texts";
import Glyph from "@/components/glyph";
import LiveFilter from "@/components/live-filter";
import { MediaGrid } from "@/components/media-card";
import Pager from "@/components/pager";
import SiteNavbar from "@/components/site-navbar";
import { db } from "@/lib/db";
import { getSiteTexts } from "@/lib/site-texts-server";
import { PER_PAGE, SORTS, SORT_LABEL, areaCounts, isSort, queryMedia, type Sort } from "@/lib/media-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "คลังสื่อการเรียนรู้", description: "สื่อการเรียนรู้ วิดีโอ เอกสาร แอปพลิเคชัน แบ่งตามกลุ่มสาระ เปิดดูและดาวน์โหลดได้ทันที" };

type SP = { q?: string; area?: string; type?: string; level?: string; by?: string; sort?: string; page?: string };

const select = "min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm";

export default async function LibraryPage({ searchParams }: { searchParams: SP }) {
  const sort: Sort = isSort(searchParams.sort) ? searchParams.sort : "latest";
  const [areas, types, levels, result, texts] = await Promise.all([
    areaCounts(),
    db.mediaType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, icon: true } }),
    db.educationLevel.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    queryMedia({ q: searchParams.q, area: searchParams.area, type: searchParams.type, level: searchParams.level, by: searchParams.by, sort, page: Number(searchParams.page) || 1 }),
    getSiteTexts(),
  ]);

  const href = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    Object.entries({ ...searchParams, ...over }).forEach(([k, v]) => v && p.set(k, String(v)));
    const s = p.toString();
    return `/library${s ? `?${s}` : ""}`;
  };
  const current = areas.find((a) => a.slug === searchParams.area);
  const filtered = !!(searchParams.q || searchParams.area || searchParams.type || searchParams.level || searchParams.by);
  const chip = "flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm transition";

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-6xl space-y-5 px-4 pb-28 pt-24 md:pb-16">
        <Breadcrumb items={current ? [{ label: plainText(texts["nav.library"]), href: "/library" }, { label: current.name }] : [{ label: plainText(texts["nav.library"]) }]} />

        <header className="space-y-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{current ? current.name : <Lines text={texts["library.title"]} />}</h1>
          <p className="text-sm text-neutral-500">{result.total.toLocaleString("th-TH")} รายการ{searchParams.q ? ` ที่ตรงกับ “${searchParams.q}”` : ""} · <Lines text={texts["library.subtitle"]} /></p>
        </header>

        {/* learning areas: one swipeable row on a phone; on a computer they wrap onto two rows so every one is visible and clickable (a hidden scrollbar can not be dragged with a mouse) */}
        <nav aria-label="กลุ่มสาระ" className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
          <ul className="flex gap-2 md:flex-wrap">
            <li><Link href={href({ area: undefined, page: undefined })} aria-current={!searchParams.area ? "page" : undefined} className={`${chip} ${!searchParams.area ? "border-brand bg-brand text-white" : "border-neutral-300 bg-white"}`}>ทั้งหมด</Link></li>
            {areas.map((a) => {
              const on = searchParams.area === a.slug;
              return (
                <li key={a.id}>
                  <Link href={href({ area: a.slug, page: undefined })} aria-current={on ? "page" : undefined} className={`${chip} ${on ? "border-transparent text-white" : "border-neutral-300 bg-white"}`} style={on ? { backgroundColor: a.color } : undefined}>
                    <Glyph name={a.icon} size={16} />{a.name}<span className={`text-xs ${on ? "text-white/80" : "text-neutral-400"}`}>{a.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <LiveFilter
          action="/library"
          omit={{ sort: "latest" }}
          className="space-y-5"
          formClassName="grid gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]"
          fields={<>
          {searchParams.area && <input type="hidden" name="area" value={searchParams.area} />}
          {searchParams.by && <input type="hidden" name="by" value={searchParams.by} />}
          <input name="q" type="search" defaultValue={searchParams.q ?? ""} placeholder="ค้นหาชื่อสื่อ แท็ก หรือผู้จัดทำ" aria-label="ค้นหาสื่อ" enterKeyHint="search" className={`${select} sm:col-span-2 lg:col-span-1`} />
          <select name="type" defaultValue={searchParams.type ?? ""} aria-label="ประเภทสื่อ" className={select}>
            <option value="">ทุกประเภท</option>
            {types.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
          </select>
          <select name="level" defaultValue={searchParams.level ?? ""} aria-label="ระดับชั้น" className={select}>
            <option value="">ทุกระดับชั้น</option>
            {levels.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
          </select>
          <select name="sort" defaultValue={sort} aria-label="เรียงตาม" className={select}>
            {SORTS.map((s) => <option key={s} value={s}>เรียง: {SORT_LABEL[s]}</option>)}
          </select>
        </>}
        >
        {filtered && <p className="text-sm"><Link href="/library" className="text-brand underline">ล้างตัวกรองทั้งหมด</Link></p>}

        {result.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <p className="font-semibold">ไม่พบสื่อที่ตรงกับเงื่อนไข</p>
            <p className="mt-1 text-sm text-neutral-500">ลองเปลี่ยนคำค้นหรือเลือกกลุ่มสาระอื่น</p>
          </div>
        ) : (
          <div className="space-y-5">
            <MediaGrid items={result.items} />
            <p className="text-center text-sm text-neutral-500" aria-live="polite">
              แสดง {((result.page - 1) * PER_PAGE + 1).toLocaleString("th-TH")}–{Math.min(result.page * PER_PAGE, result.total).toLocaleString("th-TH")} จาก {result.total.toLocaleString("th-TH")} รายการ
            </p>
            <Pager page={result.page} pages={result.pages} href={(p) => href({ page: p > 1 ? String(p) : undefined })} label={`เลือกหน้า (หน้าละ ${PER_PAGE} รายการ)`} />
          </div>
        )}
        </LiveFilter>
      </main>
    </>
  );
}
