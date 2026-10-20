import Link from "next/link";
import { db } from "@/lib/db";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { formatThaiDate } from "@/lib/thai-date";
import ResolveButton from "./resolve-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "ข้อผิดพลาดระบบ" };

const SOURCE: Record<string, string> = { client: "ในเบราว์เซอร์", boundary: "หน้าที่พัง (แสดงหน้าขออภัย)", server: "เซิร์ฟเวอร์" };

/** Problems the site noticed: pages that broke in someone's browser or showed the "sorry" page. One row per kind of problem, with how often. */
export default async function ErrorsPage({ searchParams }: { searchParams: { show?: string } }) {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const showResolved = searchParams.show === "resolved";
  const [rows, open, resolved] = await Promise.all([
    db.errorLog.findMany({ where: showResolved ? { resolvedAt: { not: null } } : { resolvedAt: null }, orderBy: { lastAt: "desc" }, take: 100 }),
    db.errorLog.count({ where: { resolvedAt: null } }),
    db.errorLog.count({ where: { resolvedAt: { not: null } } }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">ข้อผิดพลาดระบบ</h1>
        <p className="text-sm text-neutral-500">
          ปัญหาที่ระบบจับได้ เช่น หน้าที่พังในเบราว์เซอร์ของผู้ใช้ — ปัญหาเดียวกันนับจำนวนครั้ง ไม่เพิ่มแถว · ไม่เก็บ IP ชื่อ หรือข้อมูลส่วนตัว (เก็บแค่รหัสบัญชีของคนที่ล็อกอินอยู่ และปิดบังอีเมล/เลขยาวในข้อความ) · ถ้าแก้แล้วเกิดซ้ำ จะกลับมาเป็นสถานะเปิดเอง
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/errors" className={`rounded-full border px-4 py-2 ${!showResolved ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>ยังไม่แก้ ({open})</Link>
        <Link href="/admin/errors?show=resolved" className={`rounded-full border px-4 py-2 ${showResolved ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>แก้แล้ว ({resolved})</Link>
        <Link href="/admin/system" className="ml-auto rounded-full border border-neutral-300 px-4 py-2">สถานะระบบและการสำรองข้อมูล →</Link>
      </div>
      <section className="overflow-x-auto rounded-2xl bg-white p-3 shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs text-neutral-500"><tr><th className="p-2 font-medium">ล่าสุด</th><th className="p-2 font-medium">กี่ครั้ง</th><th className="p-2 font-medium">หน้า</th><th className="p-2 font-medium">ข้อความ</th><th className="p-2 font-medium">ที่มา</th><th className="p-2" /></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap p-2 text-neutral-600">{formatThaiDate(e.lastAt, { time: true })}<span className="block text-xs text-neutral-400">เริ่ม {formatThaiDate(e.firstAt)}</span></td>
                <td className="p-2 font-semibold tabular-nums">{e.count.toLocaleString("th-TH")}</td>
                <td className="p-2"><Link href={e.path} className="break-all text-brand hover:underline">{e.path}</Link></td>
                <td className="max-w-md p-2">
                  <p className="break-words">{e.message}</p>
                  {e.fingerprint.startsWith("d:") && <p className="mt-0.5 text-xs text-neutral-400">รหัสอ้างอิงเซิร์ฟเวอร์ (digest) {e.fingerprint.slice(2)} — ค้นหารหัสนี้ใน Logs ของ Vercel เพื่อดูข้อความเต็ม</p>}
                  {e.stack && <details className="mt-1"><summary className="cursor-pointer text-xs text-neutral-500">รายละเอียด</summary><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-2 text-[11px]">{e.stack}</pre></details>}
                </td>
                <td className="p-2 text-xs text-neutral-500">{SOURCE[e.source] ?? e.source}</td>
                <td className="p-2 text-right"><ResolveButton id={e.id} resolved={!!e.resolvedAt} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-neutral-500">{showResolved ? "ยังไม่มีรายการที่แก้แล้ว" : "ไม่มีข้อผิดพลาดค้างอยู่"}</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
