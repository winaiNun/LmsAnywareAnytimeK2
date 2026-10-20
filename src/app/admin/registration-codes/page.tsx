import Link from "next/link";
import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { STATUS_LABEL, codeStatus, formatCode } from "@/lib/registration";
import { formatThaiDate } from "@/lib/thai-date";
import CodeForm from "./code-form";
import RowActions from "./row-actions";

export const dynamic = "force-dynamic";

const TONE = { ok: "bg-green-50 text-green-700", inactive: "bg-neutral-100 text-neutral-500", expired: "bg-red-50 text-red-700", "used-up": "bg-amber-50 text-amber-800" } as const;

export default async function RegistrationCodesPage() {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const [codes, schools, site] = await Promise.all([
    db.registrationCode.findMany({ where: { parentId: null }, orderBy: { createdAt: "desc" }, include: { school: { select: { name: true } }, _count: { select: { children: true } } } }),
    db.school.findMany({ select: { id: true, name: true, district: true, center: true }, orderBy: { name: "asc" } }),
    db.siteSetting.findUnique({ where: { id: "main" }, select: { requireRegistrationCode: true } }),
  ]);
  const required = site?.requireRegistrationCode ?? true;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">รหัสสมัคร</h1>
        <p className="text-sm text-neutral-500">แจกรหัสให้ครู/นักเรียนที่ต้องการให้สมัครได้ รหัสกำหนดประเภทสมาชิก (และโรงเรียน ถ้าล็อกไว้) ให้เอง</p>
        {!required && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">ตอนนี้ระบบ <strong>เปิดสมัครโดยไม่ต้องใช้รหัส</strong> (ตั้งไว้ที่ ตั้งค่า › การสมัครสมาชิก) รหัสที่สร้างจึงยังไม่ถูกบังคับใช้</p>
        )}
      </div>

      <CodeForm values={{ label: "", memberType: "STUDENT", schoolId: "", expiresAt: "", maxUses: "", active: true }} schools={schools} parents={codes.map((c) => ({ id: c.id, label: `${c.label} (${formatCode(c.code)})` }))} />

      <div className="overflow-x-auto rounded-xl bg-white p-2 shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-neutral-500">
            <tr>{["รหัส", "ป้ายกำกับ", "ประเภท / โรงเรียน", "ใช้แล้ว", "หมดอายุ", "สถานะ", ""].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {codes.map((c) => {
              const st = codeStatus(c);
              return (
                <tr key={c.id} className="border-t border-neutral-100 align-top">
                  <td className="p-3"><code className="select-all rounded bg-neutral-100 px-2 py-1 text-base font-semibold tracking-wider">{formatCode(c.code)}</code></td>
                  <td className="p-3 font-medium"><Link href={`/admin/registration-codes/${c.id}`} className="text-brand hover:underline">{c.label}</Link>{c._count.children > 0 && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand">รหัสกลุ่ม</span>}</td>
                  <td className="p-3 text-neutral-600">{MEMBER_TYPE_LABEL[c.memberType]}{c.school ? <span className="block text-xs">{c.school.name}</span> : null}</td>
                  <td className="p-3 tabular-nums">{c.groupUsed}{c.maxUses !== null ? ` / ${c.maxUses}` : " / ไม่จำกัด"}{c._count.children > 0 && <span className="block text-xs text-neutral-500">รวม {c._count.children} รหัสย่อย</span>}</td>
                  <td className="p-3 text-neutral-600">{c.expiresAt ? formatThaiDate(c.expiresAt, { time: true }) : "—"}</td>
                  <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[st]}`}>{STATUS_LABEL[st]}</span></td>
                  <td className="p-3"><RowActions id={c.id} code={formatCode(c.code)} active={c.active} used={c.groupUsed} /></td>
                </tr>
              );
            })}
            {codes.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-neutral-500">ยังไม่มีรหัสสมัคร</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
