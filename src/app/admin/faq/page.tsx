import Link from "next/link";
import { db } from "@/lib/db";
import { requireManagerPage } from "@/lib/permissions";
import { formatThaiDate } from "@/lib/thai-date";
import FaqForm from "./faq-form";
import RowActions from "./row-actions";
import { ClearHandledButton, EnabledSwitch, StarterButton, UnansweredActions } from "./tools";

export const dynamic = "force-dynamic";
export const metadata = { title: "ถามตอบ (FAQ)" };

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  OPEN: { text: "รอตอบ", cls: "bg-amber-50 text-amber-800" },
  ANSWERED: { text: "ตอบแล้ว", cls: "bg-green-50 text-green-700" },
  DISMISSED: { text: "ข้าม", cls: "bg-neutral-100 text-neutral-500" },
};

export default async function FaqAdminPage({ searchParams }: { searchParams: { edit?: string; from?: string; tab?: string } }) {
  await requireManagerPage();
  const [items, unansweredRaw, setting] = await Promise.all([
    db.faqItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.faqUnanswered.findMany({ orderBy: [{ count: "desc" }, { lastAt: "desc" }], take: 200 }),
    db.siteSetting.findUnique({ where: { id: "main" }, select: { faqEnabled: true } }),
  ]);
  // waiting questions first, then the handled ones (each group keeps most-asked first)
  const rank = (st: string) => (st === "OPEN" ? 0 : st === "DISMISSED" ? 2 : 1);
  const unanswered = [...unansweredRaw].sort((a, b) => rank(a.status) - rank(b.status));
  const openCount = unanswered.filter((u) => u.status === "OPEN").length;
  const tab = searchParams.tab === "unanswered" || searchParams.from ? "unanswered" : "items";
  const editing = searchParams.edit ? items.find((i) => i.id === searchParams.edit) : undefined;
  const from = searchParams.from ? unanswered.find((u) => u.id === searchParams.from) : undefined;
  const tabCls = (on: boolean) => `min-h-11 rounded-lg px-4 py-2.5 text-sm font-medium ${on ? "bg-brand text-white" : "bg-white text-neutral-700 shadow-sm hover:bg-neutral-50"}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">ถามตอบ (FAQ)</h1>
        <p className="text-sm text-neutral-500">แชตบนหน้าเว็บตอบจากคำถาม-คำตอบที่คุณเขียนไว้ที่นี่เท่านั้น (ไม่ใช้ AI) · คำถามที่ตอบไม่ได้จะถูกเก็บไว้ในแท็บ “คำถามที่ตอบไม่ได้” ให้คุณเพิ่มคำตอบ</p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm"><EnabledSwitch enabled={setting?.faqEnabled ?? true} /></div>

      <nav className="flex flex-wrap gap-2" aria-label="ส่วนของหน้า">
        <Link href="/admin/faq" className={tabCls(tab === "items")}>คำถามที่พบบ่อย ({items.length})</Link>
        <Link href="/admin/faq?tab=unanswered" className={tabCls(tab === "unanswered")}>คำถามที่ตอบไม่ได้{openCount ? ` (${openCount})` : ""}</Link>
      </nav>

      {tab === "items" ? (
        <>
          <FaqForm
            values={editing ? { id: editing.id, question: editing.question, answer: editing.answer, keywords: editing.keywords, pinned: editing.pinned, active: editing.active } : { question: "", answer: "", keywords: "", pinned: false, active: true }}
          />
          <StarterButton />
          <div className="overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-neutral-500">
                <tr>{["คำถาม", "ตอบแล้ว (ครั้ง)", "สถานะ", "จัดการ"].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={r.id} className="border-t border-neutral-100 align-middle">
                    <td className="p-3">
                      <p className="font-medium">{r.question}{r.pinned && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">ปักหมุด</span>}</p>
                      <p className="line-clamp-2 max-w-xl text-xs text-neutral-500">{r.answer}</p>
                    </td>
                    <td className="p-3 tabular-nums">{r.hitCount.toLocaleString("th-TH")}</td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.active ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>{r.active ? "แสดง" : "ซ่อน"}</span></td>
                    <td className="p-3"><RowActions id={r.id} active={r.active} pinned={r.pinned} first={i === 0} last={i === items.length - 1} /></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-neutral-500">ยังไม่มีคำถาม — เพิ่มด้านบน หรือกด “ใส่คำถามตัวอย่างเริ่มต้น”</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {from && (
            <FaqForm
              fromUnanswered={from.id}
              values={{ question: from.sample, answer: "", keywords: from.sample, pinned: false, active: true }}
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-500">เรียงตามจำนวนครั้งที่ถูกถาม · ไม่เก็บข้อมูลผู้ถาม · ถ้าพบข้อมูลส่วนตัวในคำถาม ให้กด “ลบ”</p>
            <ClearHandledButton disabled={!unanswered.some((u) => u.status !== "OPEN")} />
          </div>
          <div className="overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-neutral-500">
                <tr>{["คำถาม", "ถามกี่ครั้ง", "ล่าสุด", "สถานะ", "จัดการ"].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {unanswered.map((u) => (
                  <tr key={u.id} className="border-t border-neutral-100 align-middle">
                    <td className="max-w-md break-words p-3 font-medium">{u.sample}</td>
                    <td className="p-3 tabular-nums">{u.count.toLocaleString("th-TH")}</td>
                    <td className="p-3 text-neutral-600">{formatThaiDate(u.lastAt, { style: "medium" })}</td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_LABEL[u.status]?.cls ?? ""}`}>{STATUS_LABEL[u.status]?.text ?? u.status}</span></td>
                    <td className="p-3"><UnansweredActions id={u.id} status={u.status} /></td>
                  </tr>
                ))}
                {unanswered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-neutral-500">ยังไม่มีคำถามที่ตอบไม่ได้</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
