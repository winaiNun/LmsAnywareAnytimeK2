import Link from "next/link";
import type { Prisma } from "@prisma/client";
import Avatar from "@/components/avatar";
import { db } from "@/lib/db";
import { avatarOf } from "@/lib/site";
import { MEMBER_TYPES, MEMBER_TYPE_LABEL, type MemberTypeKey } from "@/lib/members";
import { isAdmin, requireManagerPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PAGE = 30;

const ROLE: Record<string, [string, string]> = {
  ADMIN: ["ผู้ดูแลระบบ", "bg-purple-50 text-purple-700"],
  LIBRARIAN: ["บรรณารักษ์", "bg-blue-50 text-brand"],
  TEACHER: ["ผู้สร้างคอร์ส", "bg-amber-50 text-amber-700"],
  STUDENT: ["สมาชิก", "bg-neutral-100 text-neutral-600"],
};

type SP = { q?: string; type?: string; role?: string; school?: string; creator?: string; page?: string };

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  const me = await requireManagerPage();
  const q = searchParams.q?.trim() ?? "";
  const type = MEMBER_TYPES.includes(searchParams.type as MemberTypeKey) ? (searchParams.type as MemberTypeKey) : undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const where: Prisma.UserWhereInput = {
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] }),
    ...(type && { memberType: type }),
    ...(searchParams.role && ["ADMIN", "LIBRARIAN", "TEACHER", "STUDENT"].includes(searchParams.role) && { role: searchParams.role as "ADMIN" }),
    ...(searchParams.school && { schoolId: searchParams.school }),
    ...(searchParams.creator === "pending" && { creatorStatus: "PENDING" as const }),
  };

  const [users, total, pending, schools] = await Promise.all([
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { memberSchool: { select: { name: true } } } }),
    db.user.count({ where }),
    db.user.count({ where: { creatorStatus: "PENDING" } }),
    db.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    Object.entries({ ...searchParams, ...over }).forEach(([k, v]) => v && p.set(k, String(v)));
    return `/admin/users?${p}`;
  };
  const sel = "min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">สมาชิก</h1>
          <p className="text-sm text-neutral-500">พบ {total} คน</p>
        </div>
        {isAdmin(me.role) && (
          <div className="flex gap-2">
            <a href={`/admin/users/export?${new URLSearchParams(searchParams as Record<string, string>)}`} className="flex min-h-11 items-center rounded-lg border px-4 text-sm">ส่งออก .xlsx</a>
            <Link href="/admin/users/import" className="flex min-h-11 items-center rounded-lg border px-4 text-sm">นำเข้า Excel</Link>
            <Link href="/admin/users/new" className="flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">+ เพิ่มผู้ใช้</Link>
          </div>
        )}
      </div>

      {pending > 0 && (
        <Link href={qs({ creator: "pending", page: undefined })} className="block rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900">
          มีคำขอสมัครเป็นผู้สร้างคอร์ส {pending} รายการรอพิจารณา — คลิกเพื่อดู
        </Link>
      )}

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="ค้นหาชื่อ/อีเมล/ชื่อผู้ใช้" className={`${sel} min-w-[220px] flex-1`} />
        <select name="type" defaultValue={type ?? ""} className={sel}>
          <option value="">ทุกประเภท</option>
          {MEMBER_TYPES.map((t) => <option key={t} value={t}>{MEMBER_TYPE_LABEL[t]}</option>)}
        </select>
        <select name="role" defaultValue={searchParams.role ?? ""} className={sel}>
          <option value="">ทุกสิทธิ์</option>
          {Object.entries(ROLE).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select name="school" defaultValue={searchParams.school ?? ""} className={`${sel} max-w-[220px]`}>
          <option value="">ทุกโรงเรียน</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="min-h-11 rounded-lg bg-neutral-800 px-5 text-sm font-semibold text-white">ค้นหา</button>
      </form>

      <div className="overflow-x-auto rounded-xl bg-white p-2 shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-neutral-500">
            <tr><th className="p-3 font-medium">ชื่อ</th><th className="p-3 font-medium">อีเมล/ชื่อผู้ใช้</th><th className="p-3 font-medium">ประเภท</th><th className="p-3 font-medium">โรงเรียน/หน่วยงาน</th><th className="p-3 font-medium">สิทธิ์</th><th className="p-3 font-medium">สถานะ</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100">
                <td className="p-3 font-medium">
                  <Avatar avatar={avatarOf(u)} name={u.name} size={32} className="mr-2 align-middle" />
                  <Link href={`/admin/users/${u.id}`} className="text-brand hover:underline">{u.name}</Link>
                  {u.creatorStatus === "PENDING" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">ขอเป็นผู้สร้างคอร์ส</span>}
                </td>
                <td className="p-3 text-neutral-600">{u.email ?? u.username}</td>
                <td className="p-3">{MEMBER_TYPE_LABEL[u.memberType]}</td>
                <td className="p-3 text-neutral-600">{u.memberSchool?.name ?? u.organization ?? "-"}</td>
                <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${ROLE[u.role][1]}`}>{ROLE[u.role][0]}</span></td>
                <td className="p-3">{u.active ? <span className="text-green-700">ใช้งานอยู่</span> : <span className="text-neutral-400">ปิดใช้งาน</span>}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-500">ไม่พบสมาชิก</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="แบ่งหน้า">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="rounded border px-3 py-2">ก่อนหน้า</Link>}
          <span>หน้า {page}/{pages}</span>
          {page < pages && <Link href={qs({ page: String(page + 1) })} className="rounded border px-3 py-2">ถัดไป</Link>}
        </nav>
      )}
    </div>
  );
}
