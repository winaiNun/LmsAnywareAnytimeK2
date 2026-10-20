import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { STATUS_LABEL, codeStatus, formatCode } from "@/lib/registration";
import { formatThaiDate } from "@/lib/thai-date";
import CodeForm from "../code-form";
import RowActions from "../row-actions";
import SubCodeForm from "../sub-code-form";

export const dynamic = "force-dynamic";

const TONE = { ok: "bg-green-50 text-green-700", inactive: "bg-neutral-100 text-neutral-500", expired: "bg-red-50 text-red-700", "used-up": "bg-amber-50 text-amber-800" } as const;

export default async function CodeDetailPage({ params }: { params: { id: string } }) {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const [c, schools] = await Promise.all([
    db.registrationCode.findUnique({
      where: { id: params.id },
      include: {
        parent: true,
        children: { orderBy: { label: "asc" }, include: { school: { select: { name: true, district: true, center: true } } } },
      },
    }),
    db.school.findMany({ select: { id: true, name: true, district: true, center: true }, orderBy: { name: "asc" } }),
  ]);
  if (!c) notFound();
  const isGroup = !c.parentId;
  // everyone who signed up with this code, or (for a group code) with any of its sub-codes
  const ids = [c.id, ...c.children.map((x) => x.id)];
  const users = await db.user.findMany({
    where: { registrationCodeId: { in: ids } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, email: true, username: true, createdAt: true, registrationCode: { select: { id: true, label: true } } },
  });
  const status = codeStatus(c, new Date(), c.parent);
  const used = isGroup ? c.groupUsed : c.usedCount;
  const districts = Array.from(new Set(schools.map((s) => s.district))).sort();
  const centers = Array.from(new Set(schools.map((s) => s.center))).sort();

  return (
    <div className="space-y-5">
      <Link href={c.parent ? `/admin/registration-codes/${c.parent.id}` : "/admin/registration-codes"} className="text-sm text-brand">← {c.parent ? c.parent.label : "รหัสสมัครทั้งหมด"}</Link>
      <div>
        <h1 className="text-2xl font-bold">{c.label}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-3 text-sm">
          <code className="select-all rounded bg-neutral-100 px-2 py-1 text-lg font-semibold tracking-wider">{formatCode(c.code)}</code>
          <span>{STATUS_LABEL[status]}</span>
          <span className="text-neutral-500">ใช้แล้ว {used}{c.maxUses !== null ? ` / ${c.maxUses}` : ""} ครั้ง{isGroup && c.children.length > 0 ? ` (รวม ${c.children.length} รหัสย่อย)` : ""}</span>
        </p>
      </div>

      <CodeForm
        schools={schools}
        parentLabel={c.parent?.label}
        values={{ id: c.id, label: c.label, memberType: c.memberType, schoolId: c.schoolId ?? "", expiresAt: c.expiresAt ? c.expiresAt.toISOString() : "", maxUses: c.maxUses === null ? "" : String(c.maxUses), active: c.active, usedCount: used }}
      />

      {isGroup && <SubCodeForm parentId={c.id} districts={districts} centers={centers} />}

      {isGroup && c.children.length > 0 && (
        <section className="overflow-x-auto rounded-xl bg-white p-3 shadow-sm">
          <h2 className="px-2 pb-2 font-semibold">รหัสย่อย ({c.children.length}) — ยอดสมัครรายโรงเรียน</h2>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-neutral-500"><tr>{["รหัส", "โรงเรียน", "อำเภอ / ศูนย์", "ใช้แล้ว", "สถานะ", ""].map((h) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {c.children.map((k) => {
                const st = codeStatus(k, new Date(), c);
                return (
                  <tr key={k.id} className="border-t border-neutral-100 align-top">
                    <td className="p-2"><Link href={`/admin/registration-codes/${k.id}`}><code className="select-all rounded bg-neutral-100 px-2 py-0.5 font-semibold tracking-wider">{formatCode(k.code)}</code></Link></td>
                    <td className="p-2 font-medium">{k.label}</td>
                    <td className="p-2 text-neutral-600">{k.school ? `อ.${k.school.district} · ${k.school.center}` : "—"}</td>
                    <td className="p-2 tabular-nums">{k.usedCount}{k.maxUses !== null ? ` / ${k.maxUses}` : ""}</td>
                    <td className="p-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[st]}`}>{STATUS_LABEL[st]}</span></td>
                    <td className="p-2"><RowActions id={k.id} code={formatCode(k.code)} active={k.active} used={k.usedCount} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">สมาชิกที่สมัครด้วย{isGroup && c.children.length > 0 ? "รหัสกลุ่มนี้และรหัสย่อย" : "รหัสนี้"} ({users.length}{users.length === 200 ? "+" : ""})</h2>
        {users.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">ยังไม่มีผู้ใช้รหัสนี้ ({MEMBER_TYPE_LABEL[c.memberType]})</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/users/${u.id}`} className="font-medium text-brand hover:underline">{u.name}</Link>
                <span className="text-neutral-500">{isGroup && u.registrationCode && u.registrationCode.id !== c.id ? `${u.registrationCode.label} · ` : ""}{u.email ?? u.username} · {formatThaiDate(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
