import Link from "next/link";
import type { Prisma } from "@prisma/client";
import LiveFilter from "@/components/live-filter";
import Pager from "@/components/pager";
import { AUDIT_LABELS, auditLabel, auditLink, auditMeta } from "@/lib/audit-labels";
import { db } from "@/lib/db";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
export const metadata = { title: "บันทึกการใช้งาน" };

const PAGE = 50;
const RANGES = [["1", "24 ชั่วโมงล่าสุด"], ["7", "7 วันล่าสุด"], ["30", "30 วันล่าสุด"], ["0", "ทั้งหมด"]] as const;
type SP = { q?: string; who?: string; range?: string; page?: string };
const sel = "min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm";

/** Who did what and when: every sensitive action the system records (role changes, publishing, codes, resets, imports ...). Admins only. */
export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const q = (searchParams.q ?? "").trim().slice(0, 60);
  const who = (searchParams.who ?? "").trim().slice(0, 60);
  const range = RANGES.some(([k]) => k === searchParams.range) ? searchParams.range! : "7";
  const page = Math.max(1, Number(searchParams.page) || 1);

  // the free text matches the Thai wording too: look up the action keys whose label contains it
  const labelHits = q ? Object.entries(AUDIT_LABELS).filter(([, l]) => l.includes(q)).map(([k]) => k) : [];
  const actors = who ? await db.user.findMany({ where: { name: { contains: who, mode: "insensitive" } }, select: { id: true }, take: 50 }) : [];
  const where: Prisma.AuditLogWhereInput = {
    ...(range !== "0" && { createdAt: { gte: new Date(Date.now() - Number(range) * 86400000) } }),
    ...(q && { OR: [{ action: { contains: q, mode: "insensitive" } }, { entity: { contains: q, mode: "insensitive" } }, { entityId: q }, ...(labelHits.length ? [{ action: { in: labelHits } }] : [])] }),
    ...(who && { actorId: { in: actors.map((a) => a.id) } }),
  };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
  ]);
  const names = new Map(
    (await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
  );
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (who) s.set("who", who);
    if (range !== "7") s.set("range", range);
    if (p > 1) s.set("page", String(p));
    return `/admin/audit${s.toString() ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">บันทึกการใช้งาน</h1>
        <p className="text-sm text-neutral-500">ใครทำอะไรเมื่อไร — การกระทำสำคัญทั้งหมดที่ระบบบันทึกไว้ (เปลี่ยนสิทธิ์ เผยแพร่ ออกรหัส ตั้งรหัสผ่านใหม่ นำเข้า ฯลฯ) ใช้ตรวจย้อนหลังเมื่อมีเหตุ · ไม่บันทึกรหัสผ่านหรือข้อมูลลับ</p>
      </div>
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <LiveFilter
          className="space-y-3"
          action="/admin/audit"
          formClassName="flex flex-wrap gap-2"
          omit={{ range: "7" }}
          fields={
            <>
              <input name="q" defaultValue={q} placeholder="ค้นหาการกระทำ (เช่น ลบ, รหัสสมัคร, user.delete)" className={`${sel} min-w-[240px] flex-1`} />
              <input name="who" defaultValue={who} placeholder="ชื่อผู้ทำ" className={`${sel} min-w-[160px]`} />
              <select name="range" defaultValue={range} className={sel}>{RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </>
          }
        >
          <p className="text-sm text-neutral-600" aria-live="polite">พบ <strong className="text-neutral-900">{total.toLocaleString("th-TH")}</strong> รายการ</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-neutral-500"><tr><th className="p-2 font-medium">เวลา</th><th className="p-2 font-medium">ผู้ทำ</th><th className="p-2 font-medium">การกระทำ</th><th className="p-2 font-medium">เกี่ยวกับ</th><th className="p-2 font-medium">รายละเอียด</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((r) => {
                  const link = auditLink(r.entity, r.entityId);
                  const actor = r.actorId ? names.get(r.actorId) : null;
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="whitespace-nowrap p-2 text-neutral-600">{formatThaiDate(r.createdAt, { time: true })}</td>
                      <td className="p-2">{r.actorId ? (actor ? <Link href={`/admin/users/${r.actorId}`} className="text-brand hover:underline">{actor}</Link> : <span className="text-neutral-400">บัญชีที่ลบแล้ว</span>) : <span className="text-neutral-400">ระบบ</span>}</td>
                      <td className="p-2"><span className="font-medium">{auditLabel(r.action)}</span><span className="block text-xs text-neutral-400">{r.action}</span></td>
                      <td className="p-2">{link ? <Link href={link} className="text-brand hover:underline">{r.entity}</Link> : r.entity}{r.entityId && <span className="block max-w-[10rem] truncate text-xs text-neutral-400" title={r.entityId}>{r.entityId}</span>}</td>
                      <td className="max-w-xs break-words p-2 text-xs text-neutral-600">{auditMeta(r.meta)}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-neutral-500">ไม่พบรายการ</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={Math.min(page, pages)} pages={pages} href={href} />
        </LiveFilter>
      </section>
    </div>
  );
}
