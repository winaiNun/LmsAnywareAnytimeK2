import Breadcrumb from "@/components/breadcrumb";
import type { Metadata } from "next";
import Link from "next/link";
import Pager from "@/components/pager";
import SchoolCard from "@/components/school-card";
import SchoolsFilters from "@/components/schools-filters";
import SiteNavbar from "@/components/site-navbar";
import { getPublicSchools } from "@/lib/schools";
import { SCHOOL_SORTS, filterOptions, isSort, querySchools, schoolsHref } from "@/lib/schools-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ทำเนียบ Anywhere Anytime ของโรงเรียน" };

type Params = { q?: string; district?: string; center?: string; sort?: string; page?: string };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SchoolsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const all = await getPublicSchools();
  const { districts, centers } = filterOptions(all);

  const params: Params = { q: one(searchParams.q), district: one(searchParams.district), center: one(searchParams.center), sort: one(searchParams.sort), page: one(searchParams.page) };
  // ignore values that do not exist (old links, typos) instead of showing an empty page
  const district = districts.includes(params.district!) ? params.district! : "";
  const center = centers.some((c) => c.center === params.center && (!district || c.district === district)) ? params.center! : "";
  const sort = isSort(params.sort) ? params.sort : "name";
  const q = (params.q ?? "").slice(0, 100);

  const result = querySchools(all, { q, district, center, sort, page: parseInt(params.page ?? "1", 10) });
  const hrefFor = (page: number) => schoolsHref({ q, district, center, sort, page });
  const sortLabel = SCHOOL_SORTS.find((s) => s.value === sort)!.label;
  const filtered = !!(q || district || center);

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-24 md:pb-16">
        <header className="space-y-1">
          <Breadcrumb items={[{ label: "ทำเนียบโรงเรียน" }]} />
          <h1 className="text-2xl font-bold sm:text-3xl">ทำเนียบ Anywhere Anytime ของโรงเรียน</h1>
          <p className="text-neutral-600">เว็บไซต์การเรียนรู้ Anywhere Anytime ของทุกโรงเรียนในเขต กดที่การ์ดเพื่อเปิดเว็บไซต์ของโรงเรียน</p>
        </header>

        <SchoolsFilters
          districts={districts}
          centers={centers}
          suggestions={all.map((s) => ({ id: s.id, code: s.code, name: s.name, district: s.district, center: s.center }))}
          initial={{ q, district, center, sort }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600" aria-live="polite">
          <p>
            {filtered ? "พบ " : "ทั้งหมด "}
            <strong className="text-neutral-900">{result.total.toLocaleString("th-TH")}</strong> โรงเรียน
            {result.pages > 1 && <> · หน้า {result.page} จาก {result.pages}</>}
          </p>
          <p>เรียงตาม: {sortLabel}</p>
        </div>

        {result.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <p className="text-lg font-semibold">ไม่พบโรงเรียนที่ตรงกับที่ค้นหา</p>
            <p className="mt-1 text-neutral-500">ลองพิมพ์คำให้สั้นลง หรือเลือก “ทุกอำเภอ / ทุกศูนย์”</p>
            <Link href="/schools" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white">ล้างตัวกรอง</Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {result.items.map((s, i) => (
              <li key={s.id}>
                <SchoolCard school={s} priority={i < 4} />
              </li>
            ))}
          </ul>
        )}

        <Pager page={result.page} pages={result.pages} href={hrefFor} label="เลือกหน้าของรายการโรงเรียน" />
      </main>
    </>
  );
}
