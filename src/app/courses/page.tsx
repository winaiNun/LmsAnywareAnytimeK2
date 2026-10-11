import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/breadcrumb";
import CenterGrid from "@/components/center-grid";
import CourseCard from "@/components/course-card";
import Lines from "@/components/lines";
import LiveFilter from "@/components/live-filter";
import Pager from "@/components/pager";
import SiteNavbar from "@/components/site-navbar";
import { PER_PAGE, queryCourses } from "@/lib/course/course-data";
import { db } from "@/lib/db";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: plainText((await getSiteTexts())["courses.title"]), description: "คอร์สเรียนออนไลน์ วิดีโอ สื่อ และแบบฝึกหัด" };
}

type SP = { q?: string; area?: string; level?: string; page?: string };
const select = "min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm";

export default async function CoursesPage({ searchParams }: { searchParams: SP }) {
  const [areas, levels, result, texts] = await Promise.all([
    db.learningArea.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    db.educationLevel.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    queryCourses({ q: searchParams.q, area: searchParams.area, level: searchParams.level, page: Number(searchParams.page) || 1 }),
    getSiteTexts(),
  ]);
  const filtered = !!(searchParams.q || searchParams.area || searchParams.level);
  const href = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: searchParams.q, area: searchParams.area, level: searchParams.level })) if (v) p.set(k, v);
    if (page > 1) p.set("page", String(page));
    return `/courses${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-24 md:pb-16">
        <header className="space-y-1">
          <Breadcrumb items={[{ label: plainText(texts["nav.courses"]) }]} />
          <h1 className="text-2xl font-bold sm:text-3xl"><Lines text={texts["courses.title"]} /></h1>
          <p className="text-neutral-600"><Lines text={texts["courses.subtitle"]} /></p>
        </header>

        <LiveFilter
          action="/courses"
          className="space-y-5"
          formClassName="grid gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]"
          fields={
            <>
              <input name="q" type="search" defaultValue={searchParams.q ?? ""} placeholder="ค้นหาชื่อคอร์ส คำอธิบาย หรือผู้สอน" aria-label="ค้นหาคอร์ส" className={select} />
              <select name="area" defaultValue={searchParams.area ?? ""} aria-label="กลุ่มสาระ" className={select}>
                <option value="">ทุกกลุ่มสาระ</option>
                {areas.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
              </select>
              <select name="level" defaultValue={searchParams.level ?? ""} aria-label="ระดับชั้น" className={select}>
                <option value="">ทุกระดับชั้น</option>
                {levels.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
              </select>
            </>
          }
        >
          <p className="text-sm text-neutral-600" aria-live="polite">{filtered ? "พบ " : "ทั้งหมด "}<strong className="text-neutral-900">{result.total.toLocaleString("th-TH")}</strong> คอร์ส{filtered && <> · <Link href="/courses" className="text-brand underline">ล้างตัวกรอง</Link></>}</p>
          {result.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <p className="text-lg font-semibold">{filtered ? "ไม่พบคอร์สที่ตรงกับเงื่อนไข" : "ยังไม่มีคอร์สที่เปิดให้เรียน"}</p>
              {filtered && <p className="mt-1 text-sm text-neutral-500">ลองเปลี่ยนคำค้นหรือเลือกกลุ่มสาระอื่น</p>}
            </div>
          ) : (
            <div className="space-y-5">
              <CenterGrid variant="courses" items={result.items.map((c, i) => ({ key: c.id, node: <CourseCard course={c} priority={i < 3} /> }))} />
              <p className="text-center text-sm text-neutral-500">แสดง {((result.page - 1) * PER_PAGE + 1).toLocaleString("th-TH")}–{Math.min(result.page * PER_PAGE, result.total).toLocaleString("th-TH")} จาก {result.total.toLocaleString("th-TH")} คอร์ส</p>
              <Pager page={result.page} pages={result.pages} href={href} label={`เลือกหน้า (หน้าละ ${PER_PAGE} คอร์ส)`} />
            </div>
          )}
        </LiveFilter>
      </main>
    </>
  );
}
