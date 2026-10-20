import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import Breadcrumb from "@/components/breadcrumb";
import HonorCard from "@/components/honor-card";
import LiveFilter from "@/components/live-filter";
import Lines from "@/components/lines";
import Pager from "@/components/pager";
import SiteNavbar from "@/components/site-navbar";
import { authOptions } from "@/lib/auth";
import { getHonorsPage } from "@/lib/honors";
import { HONOR_TABS, isHonorPeriod, isHonorTab, type HonorTab } from "@/lib/honors-rank";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: plainText((await getSiteTexts())["honors.title"]) };
}

type Search = { tab?: string; period?: string; page?: string; q?: string };
const PERIOD_TABS: HonorTab[] = ["media", "courses", "likes", "views"]; // the other tabs do not depend on the period
const input = "min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm";

export default async function HonorsPage({ searchParams }: { searchParams: Search }) {
  const tab: HonorTab = isHonorTab(searchParams.tab) ? searchParams.tab : "media";
  const period = isHonorPeriod(searchParams.period) ? searchParams.period : "all";
  const q = (searchParams.q ?? "").trim().slice(0, 60);
  const [data, texts, session] = await Promise.all([getHonorsPage({ tab, period, page: Number(searchParams.page) || 1, q }), getSiteTexts(), getServerSession(authOptions)]);
  const href = (over: Partial<Search>) => {
    const p = new URLSearchParams();
    const v = { tab, period, q, ...over };
    if (v.tab && v.tab !== "media") p.set("tab", v.tab);
    if (v.period && v.period !== "all") p.set("period", v.period);
    if (v.q) p.set("q", v.q);
    if (over.page && over.page !== "1") p.set("page", over.page);
    const s = p.toString();
    return `/honors${s ? `?${s}` : ""}`;
  };
  const list = data.rows.slice(data.podium.length); // the podium already shows the first three of page 1

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-24">
        <header className="space-y-1">
          <Breadcrumb items={[{ label: plainText(texts["honors.title"]) }]} />
          <h1 className="text-2xl font-bold sm:text-3xl"><Lines text={texts["honors.title"]} /></h1>
          <p className="text-neutral-600"><Lines text={texts["honors.subtitle"]} /></p>
        </header>

        {!data.enabled ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-600">หน้านี้ปิดให้บริการชั่วคราว</p>
        ) : (
          <>
            <div role="tablist" aria-label="หมวด" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {HONOR_TABS.map((t) => (
                <Link key={t} role="tab" aria-selected={t === tab} href={href({ tab: t, page: undefined })} className={`min-h-11 shrink-0 rounded-full border px-4 py-2.5 text-sm ${t === tab ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300 bg-white hover:border-brand/40"}`}>
                  {plainText(texts[`honors.tab.${t}`])}
                </Link>
              ))}
            </div>

            <LiveFilter
              action="/honors"
              className="space-y-5"
              formClassName="grid gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto]"
              omit={{ tab: "media", period: "all" }}
              fields={
                <>
                  <input type="hidden" name="tab" value={tab} />
                  <input type="hidden" name="period" value={period} />
                  <input name="q" type="search" defaultValue={q} placeholder="ค้นหาชื่อหรือโรงเรียน/หน่วยงาน" aria-label="ค้นหาสมาชิก" className={input} />
                  {PERIOD_TABS.includes(tab) && (
                    <span className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1 text-sm" role="group" aria-label="ช่วงเวลา">
                      {([["all", "ตลอดกาล"], ["year", "ปีการศึกษานี้"]] as const).map(([v, label]) => (
                        <Link key={v} href={href({ period: v, page: undefined })} aria-current={period === v} className={`flex min-h-9 items-center rounded-lg px-3 ${period === v ? "bg-white font-semibold shadow-sm" : "text-neutral-600"}`}>{label}</Link>
                      ))}
                    </span>
                  )}
                </>
              }
            >
              {data.podium.length > 0 && (
                <ol className="grid gap-4 sm:grid-cols-3" aria-label="3 อันดับแรก">
                  {data.podium.map((m, i) => <li key={m.id}><HonorCard m={m} tab={tab} rank={i} /></li>)}
                </ol>
              )}

              {data.rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
                  <p className="text-lg font-semibold">{plainText(texts["honors.empty"])}</p>
                </div>
              ) : (
                <>
                  <p className="mt-4 text-sm text-neutral-600" aria-live="polite">{q ? "พบ " : "ทั้งหมด "}<strong className="text-neutral-900">{data.total}</strong> คน</p>
                  {list.length > 0 && (
                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {list.map((m) => <li key={m.id}><HonorCard m={m} tab={tab} /></li>)}
                    </ul>
                  )}
                  <Pager page={data.page} pages={data.pages} href={(p) => href({ page: String(p) })} />
                </>
              )}
            </LiveFilter>

            <aside className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-5 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
              <p className="text-sm leading-relaxed sm:text-base"><Lines text={texts["honors.invite"]} /></p>
              <Link href={session ? "/dashboard" : "/login?callbackUrl=/dashboard"} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-white px-5 font-semibold text-brand sm:mt-0 sm:shrink-0">{session ? "ไปที่หน้าบัญชีของฉัน" : "เข้าสู่ระบบ"}</Link>
            </aside>
          </>
        )}
      </main>
    </>
  );
}
