import Link from "next/link";
import { db } from "@/lib/db";
import { MAX_ITEMS, MAX_TABS } from "@/lib/news/merge";
import { requireManagerPage } from "@/lib/permissions";
import { formatThaiDate } from "@/lib/thai-date";
import ItemForm from "./item-form";
import { ItemActions, TabActions } from "./row-actions";
import TabForm from "./tab-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "ข่าวสาร" };

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

const badge = (on: boolean, yes: string, no: string) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${on ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>{on ? yes : no}</span>;

export default async function NewsAdminPage({ searchParams }: { searchParams: { view?: string; tab?: string; edit?: string; editTab?: string } }) {
  await requireManagerPage();
  const [tabs, items] = await Promise.all([
    db.newsTab.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { _count: { select: { items: true } } } }),
    db.newsItem.findMany({ orderBy: [{ createdAt: "desc" }], take: MAX_ITEMS }),
  ]);
  const view = searchParams.view === "tabs" || tabs.length === 0 ? "tabs" : "items";
  const filter = searchParams.tab && tabs.some((t) => t.id === searchParams.tab) ? searchParams.tab : "";
  const shown = filter ? items.filter((i) => i.tabId === filter) : items;
  const tabName = new Map(tabs.map((t) => [t.id, t.name]));
  const editing = searchParams.edit ? items.find((i) => i.id === searchParams.edit) : undefined;
  const editingTab = searchParams.editTab ? tabs.find((t) => t.id === searchParams.editTab) : undefined;
  const nav = (on: boolean) => `min-h-11 rounded-lg px-4 py-2.5 text-sm font-medium ${on ? "bg-brand text-white" : "bg-white text-neutral-700 shadow-sm hover:bg-neutral-50"}`;
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs ${on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300 bg-white text-neutral-700"}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">ข่าวสารและประชาสัมพันธ์</h1>
        <p className="text-sm text-neutral-500">สร้าง “หัวข้อข่าว” เป็นแถบ แล้วเพิ่มรายการข่าวลงในแต่ละแถบ — เป็น ลิงก์ภายนอกที่พิมพ์เอง หรือ RSS/Atom feed จากเว็บอื่น · แสดงบนหน้าแรกและหน้า “ข่าวสาร” (ชื่อหัวข้อบนหน้าแรกแก้ที่ “เซกชันหน้าแรก”)</p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="ส่วนของหน้า">
        <Link href="/admin/news" className={nav(view === "items")} aria-current={view === "items" ? "page" : undefined}>รายการข่าว ({items.length})</Link>
        <Link href="/admin/news?view=tabs" className={nav(view === "tabs")} aria-current={view === "tabs" ? "page" : undefined}>หัวข้อข่าว (แถบ) ({tabs.length}/{MAX_TABS})</Link>
      </nav>

      {tabs.length === 0 && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">เริ่มต้นด้วยการสร้างหัวข้อข่าว (แถบ) อย่างน้อย 1 หัวข้อก่อน เช่น “ข่าวประชาสัมพันธ์” แล้วจึงเพิ่มรายการข่าวได้</p>}

      {view === "tabs" ? (
        <>
          <TabForm values={editingTab ? { id: editingTab.id, name: editingTab.name, pageSize: editingTab.pageSize, active: editingTab.active } : { name: "", pageSize: 8, active: true }} />
          <div className="overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-neutral-500"><tr>{["ชื่อหัวข้อ", "รายการ", "ข่าวต่อหน้า", "สถานะ", "จัดการ"].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {tabs.map((t, i) => (
                  <tr key={t.id} className="border-t border-neutral-100 align-middle">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3 tabular-nums"><Link href={`/admin/news?tab=${t.id}`} className="text-brand hover:underline">{t._count.items}</Link></td>
                    <td className="p-3 tabular-nums">{t.pageSize}</td>
                    <td className="p-3">{badge(t.active, "แสดง", "ซ่อน")}</td>
                    <td className="p-3"><TabActions id={t.id} name={t.name} active={t.active} first={i === 0} last={i === tabs.length - 1} itemCount={t._count.items} /></td>
                  </tr>
                ))}
                {tabs.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-neutral-500">ยังไม่มีหัวข้อ — เพิ่มด้านบน</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <ItemForm
            tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
            values={
              editing
                ? { id: editing.id, tabId: editing.tabId, kind: editing.kind, title: editing.title, url: editing.url, note: editing.note ?? "", publishedAt: editing.publishedAt ? editing.publishedAt.toISOString() : "", pinned: editing.pinned, active: editing.active, feedLimit: editing.feedLimit, feedCacheMin: editing.feedCacheMin }
                : { tabId: filter, kind: "LINK", title: "", url: "", note: "", publishedAt: "", pinned: false, active: true, feedLimit: 20, feedCacheMin: 60 }
            }
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามแถบหัวข้อ">
            <Link href="/admin/news" className={chip(!filter)}>ทั้งหมด</Link>
            {tabs.map((t) => <Link key={t.id} href={`/admin/news?tab=${t.id}`} className={chip(filter === t.id)}>{t.name} ({t._count.items})</Link>)}
          </div>
          <div className="overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-neutral-500"><tr>{["รายการ", "แถบ", "ชนิด", "วันที่ / รอบดึง", "สถานะ", "จัดการ"].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.id} className="border-t border-neutral-100 align-middle">
                    <td className="max-w-sm p-3">
                      <p className="line-clamp-2 break-words font-medium">{i.pinned && <span className="mr-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">ปักหมุด</span>}{i.title}</p>
                      <a href={i.url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-brand hover:underline">{hostOf(i.url)}</a>
                    </td>
                    <td className="p-3 text-neutral-600">{tabName.get(i.tabId)}</td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${i.kind === "FEED" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"}`}>{i.kind === "FEED" ? "RSS/Atom" : "ลิงก์"}</span></td>
                    <td className="p-3 text-neutral-600">{i.kind === "FEED" ? `ทุก ${i.feedCacheMin >= 60 ? `${i.feedCacheMin / 60} ชม.` : `${i.feedCacheMin} นาที`} · ${i.feedLimit} ข่าว` : formatThaiDate(i.publishedAt ?? i.createdAt)}</td>
                    <td className="p-3">{badge(i.active, "แสดง", "ซ่อน")}</td>
                    <td className="p-3"><ItemActions id={i.id} kind={i.kind} active={i.active} pinned={i.pinned} /></td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-500">ยังไม่มีรายการ{filter ? "ในแถบนี้" : ""} — เพิ่มด้านบน</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
