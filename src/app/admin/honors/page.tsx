import Link from "next/link";
import type { Prisma } from "@prisma/client";
import Avatar from "@/components/avatar";
import LiveFilter from "@/components/live-filter";
import Pager from "@/components/pager";
import { db } from "@/lib/db";
import { MEMBER_TYPES, MEMBER_TYPE_LABEL, type MemberTypeKey } from "@/lib/members";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { avatarOf } from "@/lib/site";
import { HideButton, HonorsSettingsForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "เชิดชูผู้สร้าง" };

const PAGE = 30;
type SP = { q?: string; type?: string; status?: string; page?: string };
const STATUS = [["agreed", "ยินยอมและแสดงอยู่"], ["hidden", "ถูกซ่อนโดยผู้ดูแล"], ["no", "ยังไม่ยินยอม"]] as const;
const sel = "min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm";

export default async function HonorsAdminPage({ searchParams }: { searchParams: SP }) {
  const me = await requireManagerPage();
  const q = searchParams.q?.trim() ?? "";
  const type = MEMBER_TYPES.includes(searchParams.type as MemberTypeKey) ? (searchParams.type as MemberTypeKey) : undefined;
  const status = STATUS.some(([k]) => k === searchParams.status) ? searchParams.status : "";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const where: Prisma.UserWhereInput = {
    role: { in: ["STUDENT", "TEACHER"] },
    school: { is: null },
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }),
    ...(type && { memberType: type }),
    ...(status === "agreed" && { showInHonors: true, honorsHidden: false }),
    ...(status === "hidden" && { honorsHidden: true }),
    ...(status === "no" && { showInHonors: false }),
  };
  const [site, total, rows] = await Promise.all([
    db.siteSetting.findUnique({ where: { id: "main" }, select: { honorsEnabled: true, honorsMinItems: true } }),
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ showInHonors: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true, name: true, memberType: true, showInHonors: true, honorsHidden: true, active: true,
        avatarKey: true, avatarDriveId: true, avatarCx: true, avatarCy: true, avatarZoom: true, avatarAspect: true,
        memberSchool: { select: { name: true } }, organization: true,
        _count: { select: { mediaCreated: { where: { status: "PUBLISHED" } }, coursesCreated: { where: { status: "PUBLISHED" } } } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (type) s.set("type", type);
    if (status) s.set("status", status);
    if (p > 1) s.set("page", String(p));
    return `/admin/honors${s.toString() ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">เชิดชูผู้สร้าง</h1>
        <p className="text-sm text-neutral-500">สมาชิกจะขึ้นหน้าเชิดชูก็ต่อเมื่อ <strong>เจ้าตัวกดยินยอม</strong> ในหน้าบัญชีของตน · สมาชิกประเภทนักเรียนไม่แสดงสาธารณะเลย (เห็นได้เฉพาะในหน้านี้) · ผู้ดูแลซ่อนใครออกจากหน้าสาธารณะได้</p>
      </div>
      <HonorsSettingsForm enabled={site?.honorsEnabled ?? true} minItems={site?.honorsMinItems ?? 1} canEdit={isAdmin(me.role)} />

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <LiveFilter
          className="space-y-3"
          action="/admin/honors"
          formClassName="flex flex-wrap gap-2"
          fields={
            <>
              <input name="q" defaultValue={q} placeholder="ค้นหาชื่อ/อีเมล/ชื่อผู้ใช้" className={`${sel} min-w-[220px] flex-1`} />
              <select name="type" defaultValue={type ?? ""} className={sel}>
                <option value="">ทุกประเภท</option>
                {MEMBER_TYPES.map((t) => <option key={t} value={t}>{MEMBER_TYPE_LABEL[t]}</option>)}
              </select>
              <select name="status" defaultValue={status} className={sel}>
                <option value="">ทุกสถานะ</option>
                {STATUS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </>
          }
        >
          <p className="text-sm text-neutral-600" aria-live="polite">ทั้งหมด <strong className="text-neutral-900">{total.toLocaleString("th-TH")}</strong> คน</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-neutral-500">
                <tr><th className="p-2 font-medium">สมาชิก</th><th className="p-2 font-medium">ประเภท</th><th className="p-2 font-medium">สื่อ / คอร์ส (เผยแพร่)</th><th className="p-2 font-medium">สถานะในหน้าเชิดชู</th><th className="p-2" /></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((u) => {
                  const student = u.memberType === "STUDENT";
                  const state = student ? ["ไม่แสดงสาธารณะ (นักเรียน)", "bg-neutral-100 text-neutral-600"] : u.honorsHidden ? ["ซ่อนโดยผู้ดูแล", "bg-red-50 text-red-700"] : u.showInHonors ? ["แสดงอยู่", "bg-green-50 text-green-700"] : ["ยังไม่ยินยอม", "bg-amber-50 text-amber-700"];
                  return (
                    <tr key={u.id}>
                      <td className="p-2">
                        <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2 hover:text-brand">
                          <Avatar avatar={avatarOf(u)} name={u.name} size={32} />
                          <span className="min-w-0"><span className="block truncate font-medium">{u.name}</span><span className="block truncate text-xs text-neutral-500">{u.memberSchool?.name ?? u.organization ?? ""}</span></span>
                        </Link>
                      </td>
                      <td className="p-2">{MEMBER_TYPE_LABEL[u.memberType as MemberTypeKey]}</td>
                      <td className="p-2 tabular-nums">{u._count.mediaCreated} / {u._count.coursesCreated}</td>
                      <td className="p-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${state[1]}`}>{state[0]}</span></td>
                      <td className="p-2 text-right">{!student && (u.showInHonors || u.honorsHidden) && <HideButton userId={u.id} hidden={u.honorsHidden} />}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-neutral-500">ไม่พบสมาชิก</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={Math.min(page, pages)} pages={pages} href={href} />
        </LiveFilter>
      </section>
    </div>
  );
}
