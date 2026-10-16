import Glyph from "@/components/glyph";
import StatCards from "@/components/stat-cards";
import { db } from "@/lib/db";
import { requireManagerPage } from "@/lib/permissions";
import { computeStats } from "@/lib/stats/compute";
import { MAX_STAT_CARDS, STAT_METRICS, STAT_METRIC_KEYS, formatStat, isStatMetric, statIcon, statLabel, type StatMetric } from "@/lib/stats/metrics";
import CardForm from "./card-form";
import { CardActions, ResetButton } from "./row-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตัวเลขสรุปหน้าแรก" };

export default async function StatCardsAdminPage({ searchParams }: { searchParams: { edit?: string } }) {
  await requireManagerPage();
  const [rows, current] = await Promise.all([db.statCard.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }), computeStats(STAT_METRIC_KEYS)]);
  const editing = searchParams.edit ? rows.find((r) => r.id === searchParams.edit) : undefined;
  const preview = rows
    .filter((r) => r.visible && isStatMetric(r.metric))
    .map((r) => ({ id: r.id, metric: r.metric as StatMetric, label: statLabel(r), icon: statIcon(r), value: current[r.metric] ?? 0 }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">ตัวเลขสรุปหน้าแรก</h1>
        <p className="text-sm text-neutral-500">การ์ดตัวเลขใต้แบนเนอร์หน้าแรก (สื่อ คอร์ส ผู้สร้างสื่อ/วิทยากร ผู้เรียน/นักเรียน ฯลฯ) · เลือกตัวเลข เปลี่ยนข้อความและไอคอน เรียงลำดับ หรือซ่อนได้ · เป็นตัวเลขของเนื้อหาและสมาชิก ไม่ใช่สถิติผู้เข้าชม · หน้าเว็บอัปเดตตัวเลขทุกไม่เกิน 10 นาที (แก้การ์ดแล้วเห็นทันที)</p>
      </div>

      <section aria-label="ตัวอย่าง" className="space-y-2 rounded-2xl bg-neutral-100 p-4">
        <p className="text-sm font-medium text-neutral-600">ตัวอย่างบนหน้าแรก</p>
        {preview.length > 0 ? <StatCards cards={preview} regionLabel="ตัวอย่างการ์ดตัวเลข" overlap={false} /> : <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">ยังไม่มีการ์ดที่แสดง — หน้าแรกจะไม่แสดงแถบตัวเลข</p>}
      </section>

      <CardForm
        values={editing ? { id: editing.id, metric: isStatMetric(editing.metric) ? editing.metric : "media", label: editing.label ?? "", icon: editing.icon ?? "", visible: editing.visible } : { metric: "media", label: "", icon: "", visible: true }}
        current={current}
        full={rows.length >= MAX_STAT_CARDS}
      />

      <div className="space-y-2 rounded-2xl bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2">
          <p className="text-sm text-neutral-500">{rows.length}/{MAX_STAT_CARDS} ใบ</p>
          <ResetButton />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-neutral-500"><tr>{["", "ข้อความบนการ์ด", "ตัวเลข", "ค่าตอนนี้", "สถานะ", "จัดการ"].map((h, i) => <th key={i} className="p-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const known = isStatMetric(r.metric);
                return (
                  <tr key={r.id} className="border-t border-neutral-100 align-middle">
                    <td className="w-12 p-3 text-brand"><Glyph name={statIcon(r)} size={22} /></td>
                    <td className="p-3 font-medium">{statLabel(r)}{r.label ? "" : <span className="ml-2 text-xs font-normal text-neutral-400">(ข้อความเริ่มต้น)</span>}</td>
                    <td className="p-3 text-neutral-600">{known ? STAT_METRICS[r.metric as StatMetric].label : <span className="text-red-600">ตัวเลขนี้ถูกยกเลิกแล้ว</span>}</td>
                    <td className="p-3 tabular-nums">{known ? formatStat(current[r.metric]) : "—"}</td>
                    <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.visible ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>{r.visible ? "แสดง" : "ซ่อน"}</span></td>
                    <td className="p-3"><CardActions id={r.id} visible={r.visible} first={i === 0} last={i === rows.length - 1} /></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-500">ยังไม่มีการ์ด — เพิ่มด้านบน หรือกด “คืนค่าเริ่มต้น”</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
