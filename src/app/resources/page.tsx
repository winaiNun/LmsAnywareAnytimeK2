import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/breadcrumb";
import CenterGrid from "@/components/center-grid";
import LiveFilter from "@/components/live-filter";
import ResourceCard from "@/components/resource-card";
import SiteNavbar from "@/components/site-navbar";
import { db } from "@/lib/db";
import { resourceImageOf } from "@/lib/resource-image";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "แหล่งสื่อภายนอก", description: "รวมเว็บไซต์และช่องทางแหล่งสื่อการเรียนรู้ที่แนะนำ" };

const select = "min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm";

export default async function ResourcesPage({ searchParams }: { searchParams: { q?: string; group?: string } }) {
  const all = await db.resourceLink.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const groups = Array.from(new Set(all.map((r) => r.groupName)));
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const group = groups.includes(searchParams.group ?? "") ? searchParams.group! : "";
  const low = q.toLowerCase();
  const rows = all.filter((r) => (!group || r.groupName === group) && (!low || `${r.name} ${r.description ?? ""} ${r.url}`.toLowerCase().includes(low)));

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-24">
        <header className="space-y-1">
          <Breadcrumb items={[{ label: "แหล่งสื่อภายนอก" }]} />
          <h1 className="text-2xl font-bold sm:text-3xl">แหล่งสื่อภายนอก</h1>
          <p className="text-neutral-600">เว็บไซต์และช่องทางที่ผู้ดูแลคัดมาให้ เปิดในแท็บใหม่ ระบบไม่รับผิดชอบเนื้อหาของเว็บภายนอก</p>
        </header>

        <LiveFilter
          action="/resources"
          className="space-y-5"
          formClassName="grid gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-[2fr_1fr]"
          fields={
            <>
              <input name="q" type="search" defaultValue={q} placeholder="ค้นหาชื่อหรือคำอธิบาย" aria-label="ค้นหาแหล่งสื่อ" className={select} />
              <select name="group" defaultValue={group} aria-label="กลุ่ม" className={select}>
                <option value="">ทุกกลุ่ม</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </>
          }
        >
          <p className="text-sm text-neutral-600" aria-live="polite">{q || group ? "พบ " : "ทั้งหมด "}<strong className="text-neutral-900">{rows.length}</strong> รายการ{(q || group) && <> · <Link href="/resources" className="text-brand underline">ล้างตัวกรอง</Link></>}</p>
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <p className="text-lg font-semibold">{all.length === 0 ? "ยังไม่มีแหล่งสื่อ" : "ไม่พบรายการที่ตรงกับที่ค้นหา"}</p>
            </div>
          ) : (
            <CenterGrid variant="resources" items={rows.map((r) => ({ key: r.id, node: <ResourceCard r={{ ...r, image: resourceImageOf(r) }} /> }))} />
          )}
        </LiveFilter>
      </main>
    </>
  );
}
