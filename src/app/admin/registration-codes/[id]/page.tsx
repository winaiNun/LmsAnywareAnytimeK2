import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { STATUS_LABEL, codeStatus, formatCode } from "@/lib/registration";
import { formatThaiDate } from "@/lib/thai-date";
import CodeForm from "../code-form";

export const dynamic = "force-dynamic";

export default async function CodeDetailPage({ params }: { params: { id: string } }) {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const [c, schools] = await Promise.all([
    db.registrationCode.findUnique({
      where: { id: params.id },
      include: { users: { orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true, email: true, username: true, createdAt: true } } },
    }),
    db.school.findMany({ select: { id: true, name: true, district: true, center: true }, orderBy: { name: "asc" } }),
  ]);
  if (!c) notFound();

  return (
    <div className="space-y-5">
      <Link href="/admin/registration-codes" className="text-sm text-brand">← รหัสสมัครทั้งหมด</Link>
      <div>
        <h1 className="text-2xl font-bold">{c.label}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-3 text-sm">
          <code className="select-all rounded bg-neutral-100 px-2 py-1 text-lg font-semibold tracking-wider">{formatCode(c.code)}</code>
          <span>{STATUS_LABEL[codeStatus(c)]}</span>
          <span className="text-neutral-500">ใช้แล้ว {c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ""} ครั้ง</span>
        </p>
      </div>

      <CodeForm
        schools={schools}
        values={{ id: c.id, label: c.label, memberType: c.memberType, schoolId: c.schoolId ?? "", expiresAt: c.expiresAt ? c.expiresAt.toISOString() : "", maxUses: c.maxUses === null ? "" : String(c.maxUses), active: c.active, usedCount: c.usedCount }}
      />

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">สมาชิกที่สมัครด้วยรหัสนี้ ({c.users.length})</h2>
        {c.users.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">ยังไม่มีผู้ใช้รหัสนี้ ({MEMBER_TYPE_LABEL[c.memberType]})</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 text-sm">
            {c.users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/users/${u.id}`} className="font-medium text-brand hover:underline">{u.name}</Link>
                <span className="text-neutral-500">{u.email ?? u.username} · {formatThaiDate(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
