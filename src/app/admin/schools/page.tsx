import Link from "next/link";
import Pager from "@/components/pager";
import { db } from "@/lib/db";
import { requireManagerPage } from "@/lib/permissions";
import { SCHOOL_SORTS, filterOptions, isSort, querySchools, schoolsHref, type SchoolListItem } from "@/lib/schools-data";
import { fileUrl } from "@/lib/site";
import { setSchoolActive } from "./actions";
import CardJob from "./card-job";

export const dynamic = "force-dynamic";

type Admin = SchoolListItem & { email: string | null; active: boolean; cardStatus: string; cardError: string | null; cardSource: boolean; hasAccount: boolean; mustChange: boolean };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const STATUS = [
  ["", "ทั้งหมด"],
  ["nocard", "ยังไม่มีภาพการ์ด"],
  ["failed", "ดึงการ์ดไม่สำเร็จ"],
  ["nolink", "ไม่มีลิงก์เว็บไซต์"],
  ["noaccount", "ไม่มีบัญชีผู้ใช้"],
  ["mustchange", "ยังไม่เปลี่ยนรหัสผ่าน"],
  ["inactive", "ปิดแสดงอยู่"],
] as const;

export default async function AdminSchoolsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireManagerPage();
  const rows = await db.school.findMany({ include: { account: { select: { mustChangePassword: true } } } });
  const all: Admin[] = rows.map((s) => ({
    id: s.id, code: s.code, name: s.name, district: s.district, center: s.center, siteUrl: s.siteUrl, cardUrl: fileUrl(s.cardKey), updatedAt: s.updatedAt.getTime(),
    email: s.email, active: s.active, cardStatus: s.cardStatus, cardError: s.cardError, cardSource: !!s.cardSourceUrl, hasAccount: !!s.accountId, mustChange: !!s.account?.mustChangePassword,
  }));

  const { districts, centers } = filterOptions(all);
  const q = one(searchParams.q).slice(0, 100);
  const district = districts.includes(one(searchParams.district)) ? one(searchParams.district) : "";
  const center = centers.some((c) => c.center === one(searchParams.center)) ? one(searchParams.center) : "";
  const status = STATUS.some(([v]) => v === one(searchParams.status)) ? one(searchParams.status) : "";
  const sort = isSort(one(searchParams.sort)) ? one(searchParams.sort) : "name";

  const byStatus = all.filter((s) => {
    switch (status) {
      case "nocard": return !s.cardUrl;
      case "failed": return s.cardStatus === "failed";
      case "nolink": return !s.siteUrl;
      case "noaccount": return !s.hasAccount;
      case "mustchange": return s.mustChange;
      case "inactive": return !s.active;
      default: return true;
    }
  });
  const result = querySchools(byStatus, { q, district, center, sort, page: parseInt(one(searchParams.page) || "1", 10), perPage: 25 });
  const href = (page: number) => {
    const base = schoolsHref({ q, district, center, sort, page }).replace("/schools", "/admin/schools");
    return status ? `${base}${base.includes("?") ? "&" : "?"}status=${status}` : base;
  };
  const missingCards = all.filter((s) => s.cardSource && (!s.cardUrl || s.cardStatus === "failed")).length;
  const stat = (label: string, n: number, tone = "text-neutral-900") => (
    <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-sm text-neutral-500">{label}</p><p className={`text-2xl font-bold ${tone}`}>{n.toLocaleString("th-TH")}</p></div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ทำเนียบโรงเรียน</h1>
          <p className="text-sm text-neutral-500">Anywhere Anytime ของโรงเรียนในเขต — นำเข้าจาก Excel แล้วโรงเรียนเข้าไปแก้ลิงก์/การ์ดของตัวเองได้</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/admin/schools/template" className="flex min-h-11 items-center rounded-lg border border-neutral-300 bg-white px-4 text-sm hover:bg-neutral-50">ดาวน์โหลดแม่แบบ Excel</a>
          <a href="/admin/schools/export" className="flex min-h-11 items-center rounded-lg border border-neutral-300 bg-white px-4 text-sm hover:bg-neutral-50">ส่งออก Excel</a>
          <Link href="/admin/schools/import" className="flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-dark">นำเข้าจาก Excel</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stat("โรงเรียนทั้งหมด", all.length)}
        {stat("มีภาพการ์ดแล้ว", all.filter((s) => s.cardUrl).length, "text-green-700")}
        {stat("ยังไม่มีภาพการ์ด", all.filter((s) => !s.cardUrl).length, "text-amber-700")}
        {stat("ไม่มีลิงก์เว็บไซต์", all.filter((s) => !s.siteUrl).length, "text-amber-700")}
        {stat("ยังไม่เปลี่ยนรหัสผ่าน", all.filter((s) => s.mustChange).length)}
      </div>

      <CardJob missing={missingCards} />

      <form method="get" className="grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-12" role="search">
        <label className="md:col-span-4"><span className="mb-1 block text-sm font-medium">ค้นหา</span>
          <input name="q" defaultValue={q} placeholder="ชื่อ รหัส อำเภอ ศูนย์" className="min-h-11 w-full rounded-lg border border-neutral-300 px-3" /></label>
        <label className="md:col-span-2"><span className="mb-1 block text-sm font-medium">อำเภอ</span>
          <select name="district" defaultValue={district} className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-2"><option value="">ทุกอำเภอ</option>{districts.map((d) => <option key={d}>{d}</option>)}</select></label>
        <label className="md:col-span-2"><span className="mb-1 block text-sm font-medium">ศูนย์</span>
          <select name="center" defaultValue={center} className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-2"><option value="">ทุกศูนย์</option>{centers.map((c) => <option key={c.center}>{c.center}</option>)}</select></label>
        <label className="md:col-span-2"><span className="mb-1 block text-sm font-medium">สถานะ</span>
          <select name="status" defaultValue={status} className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-2">{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="md:col-span-2"><span className="mb-1 block text-sm font-medium">เรียงตาม</span>
          <select name="sort" defaultValue={sort} className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-2">{SCHOOL_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
        <div className="flex gap-2 md:col-span-12"><button className="min-h-11 rounded-lg bg-brand px-6 text-sm font-semibold text-white">ค้นหา</button><Link href="/admin/schools" className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-4 text-sm">ล้าง</Link></div>
      </form>

      <p className="text-sm text-neutral-600">พบ <strong>{result.total}</strong> โรงเรียน · หน้า {result.page}/{result.pages}</p>

      <ul className="space-y-2">
        {result.items.map((s) => (
          <li key={s.id} className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 ${s.active ? "border-neutral-200" : "border-neutral-200 opacity-60"}`}>
            <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.cardUrl && <img src={s.cardUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{s.name}</p>
              <p className="truncate text-xs text-neutral-500">{s.code} · อ.{s.district} · {s.center}{s.email ? ` · ${s.email}` : ""}</p>
              <div className="mt-1 flex flex-wrap gap-1 text-xs font-medium">
                <span className={`rounded-full px-2 py-0.5 ${s.siteUrl ? "bg-green-50 text-green-700" : "bg-amber-100 text-amber-800"}`}>{s.siteUrl ? "มีลิงก์เว็บ" : "ไม่มีลิงก์เว็บ"}</span>
                <span className={`rounded-full px-2 py-0.5 ${s.cardUrl ? "bg-green-50 text-green-700" : s.cardStatus === "failed" ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-600"}`} title={s.cardError ?? undefined}>{s.cardUrl ? "มีภาพการ์ด" : s.cardStatus === "failed" ? "ดึงการ์ดไม่สำเร็จ" : "ยังไม่มีการ์ด"}</span>
                <span className={`rounded-full px-2 py-0.5 ${s.hasAccount ? (s.mustChange ? "bg-blue-50 text-brand" : "bg-green-50 text-green-700") : "bg-neutral-100 text-neutral-600"}`}>{s.hasAccount ? (s.mustChange ? "บัญชี: รอเปลี่ยนรหัส" : "บัญชี: ใช้งานแล้ว") : "ไม่มีบัญชี"}</span>
                {!s.active && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-neutral-600">ปิดแสดง</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <form action={setSchoolActive.bind(null, s.id, !s.active)}><button className="min-h-10 rounded-lg border border-neutral-300 px-3 text-sm">{s.active ? "ปิดแสดง" : "เปิดแสดง"}</button></form>
              <Link href={`/admin/schools/${s.id}`} className="flex min-h-10 items-center rounded-lg border border-neutral-300 px-3 text-sm hover:bg-neutral-50">แก้ไข</Link>
            </div>
          </li>
        ))}
        {result.items.length === 0 && <li className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-500">ไม่พบโรงเรียน {all.length === 0 && "— เริ่มจากกด “นำเข้าจาก Excel”"}</li>}
      </ul>

      <Pager page={result.page} pages={result.pages} href={href} label="เลือกหน้าของรายการโรงเรียน (หลังบ้าน)" />
    </div>
  );
}
