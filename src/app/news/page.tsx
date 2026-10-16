import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/breadcrumb";
import Lines from "@/components/lines";
import NewsCardView from "@/components/news/news-card";
import NewsTabStrip from "@/components/news/news-tab-strip";
import Pager from "@/components/pager";
import SiteNavbar from "@/components/site-navbar";
import { getNewsPage, getNewsTabs } from "@/lib/news/data";
import { tabColors, toneFor } from "@/lib/news/palette";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const texts = await getSiteTexts();
  return { title: plainText(texts["news.title"]) };
}

/** All the news, one tab at a time. The tab and the page are in the URL (?tab=…&page=…), so a link to a page can be shared. */
export default async function NewsPage({ searchParams }: { searchParams: { tab?: string; page?: string } }) {
  const [texts, tabs] = await Promise.all([getSiteTexts(), getNewsTabs()]);
  const tab = tabs.find((t) => t.id === searchParams.tab) ?? tabs[0];
  const tabIndex = Math.max(0, tabs.findIndex((t) => t.id === tab?.id));
  const data = tab ? await getNewsPage(tab.id, searchParams.page) : null;
  const href = (id: string, page = 1) => `/news?tab=${id}${page > 1 ? `&page=${page}` : ""}`;

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-24">
        <Breadcrumb items={[{ label: plainText(texts["nav.news"]) }]} />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl"><Lines text={texts["news.title"]} /></h1>
          <p className="text-neutral-600"><Lines text={texts["news.subtitle"]} /></p>
        </div>

        {!tab ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">{texts["news.empty"]}</p>
        ) : (
          <>
            {tabs.length > 1 && <NewsTabStrip items={tabs.map((t, i) => ({ id: t.id, label: t.name, href: href(t.id), colors: tabColors(i) }))} activeId={tab.id} label="หัวข้อข่าว" idPrefix="newspage" />}
            {data && data.items.length > 0 ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {data.items.map((c, i) => <li key={c.key} className="min-w-0"><NewsCardView card={c} tone={toneFor(tabIndex, (data.page - 1) * data.tab.pageSize + i)} toneWide={toneFor(tabIndex, i + Math.floor(i / 2))} /></li>)}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">{texts["news.empty"]}</p>
            )}
            {data && data.failed.length > 0 && <p className="text-center text-xs text-amber-700">{texts["news.sourceError"].replace("{name}", data.failed.join(", "))}</p>}
            {data && (
              <div className="space-y-2">
                <Pager page={data.page} pages={data.pages} href={(p) => href(tab.id, p)} label="เลือกหน้าข่าว" />
                {data.total > 0 && <p className="text-center text-xs text-neutral-500">ทั้งหมด {data.total.toLocaleString("th-TH")} ข่าวในหัวข้อ “{tab.name}”</p>}
              </div>
            )}
            <p className="text-center text-sm"><Link href="/" className="text-brand hover:underline">← กลับหน้าแรก</Link></p>
          </>
        )}
      </main>
    </>
  );
}
