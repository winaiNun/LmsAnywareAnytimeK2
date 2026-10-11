import Link from "next/link";
import LiveFilter from "@/components/live-filter";
import type { Prisma } from "@prisma/client";
import Glyph from "@/components/glyph";
import { db } from "@/lib/db";
import { STATUS_LABEL, cardSelect } from "@/lib/media-data";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
const PAGE = 30;
type SP = { q?: string; status?: string; area?: string; page?: string };

export default async function AdminMediaPage({ searchParams }: { searchParams: SP }) {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const where: Prisma.MediaWhereInput = {
    ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { tags: { has: q } }, { createdBy: { name: { contains: q, mode: "insensitive" } } }] }),
    ...(searchParams.status && STATUS_LABEL[searchParams.status] && { status: searchParams.status as "DRAFT" }),
    ...(searchParams.area && { areaId: searchParams.area }),
  };
  const [items, total, areas, counts] = await Promise.all([
    db.media.findMany({ where, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], skip: (page - 1) * PAGE, take: PAGE, select: cardSelect }),
    db.media.count({ where }),
    db.learningArea.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.media.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const qs = (over: Partial<SP>) => { const p = new URLSearchParams(); Object.entries({ ...searchParams, ...over }).forEach(([k, v]) => v && p.set(k, String(v))); return `/admin/media?${p}`; };
  const sel = "min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">คลังสื่อการเรียนรู้</h1>
          <p className="text-sm text-neutral-500">พบ {total} รายการ · เผยแพร่ {count("PUBLISHED")} · รออนุมัติ {count("PENDING")} · ร่าง {count("DRAFT")} · ส่งกลับ {count("REJECTED")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/media-taxonomy" className="flex min-h-11 items-center rounded-lg border px-4 text-sm">กลุ่มสาระ/ผู้ตรวจ</Link>
          <Link href="/admin/media/new" className="flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">+ เพิ่มสื่อ</Link>
        </div>
      </div>

      {count("PENDING") > 0 && !searchParams.status && (
        <Link href={qs({ status: "PENDING", page: undefined })} className="block rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">มีสื่อรออนุมัติ {count("PENDING")} ชิ้น — คลิกเพื่อดู</Link>
      )}

      <LiveFilter className="space-y-4" action="/admin/media" formClassName="flex flex-wrap gap-2" fields={<>
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อสื่อ/แท็ก/ผู้จัดทำ" className={`${sel} min-w-[200px] flex-1`} />
        <select name="status" defaultValue={searchParams.status ?? ""} className={sel}>
          <option value="">ทุกสถานะ</option>
          {Object.entries(STATUS_LABEL).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select name="area" defaultValue={searchParams.area ?? ""} className={`${sel} max-w-[220px]`}>
          <option value="">ทุกกลุ่มสาระ</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </>}>

      <div className="overflow-x-auto rounded-xl bg-white p-2 shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-neutral-500"><tr>{["สื่อ", "กลุ่มสาระ", "ผู้ส่ง", "สถานะ", "ดู / ถูกใจ", "อัปเดต", ""].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {items.map((m) => {
              const [label, tone] = STATUS_LABEL[m.status];
              return (
                <tr key={m.id} className="border-t border-neutral-100 align-top">
                  <td className="p-3 font-medium"><Link href={`/admin/media/${m.id}`} className="text-brand hover:underline">{m.pinned && <Glyph name="pin" size={14} className="mr-1 inline-block align-[-2px] text-amber-600" />}{m.title}</Link></td>
                  <td className="p-3 text-neutral-600"><span className="inline-flex items-center gap-1.5"><Glyph name={m.area.icon} size={15} />{m.area.name}</span></td>
                  <td className="p-3 text-neutral-600">{m.createdBy.name}</td>
                  <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{label}</span></td>
                  <td className="p-3 tabular-nums text-neutral-600">{m.viewCount} / {m.likeCount}</td>
                  <td className="p-3 text-neutral-600">{formatThaiDate(m.updatedAt)}</td>
                  <td className="p-3"><Link href={`/admin/media/${m.id}/edit`} className="text-sm text-brand">แก้ไข</Link></td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-neutral-500">ไม่พบสื่อ</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="แบ่งหน้า">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="rounded border px-3 py-2">ก่อนหน้า</Link>}
          <span>หน้า {page}/{pages}</span>
          {page < pages && <Link href={qs({ page: String(page + 1) })} className="rounded border px-3 py-2">ถัดไป</Link>}
        </nav>
      )}</LiveFilter>

    </div>
  );
}
