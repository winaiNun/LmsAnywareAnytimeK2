import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { requireManagerPage } from "@/lib/permissions";
import { LIMITS, lockedSignIns } from "@/lib/rate-limit-db";
import { getSiteInfo } from "@/lib/site";
import { formatThaiDate } from "@/lib/thai-date";
import { ApproveAll, AutoRefresh, ModeSwitch, RowButtons, UnlockButton } from "./controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "อนุมัติผู้สมัคร" };

/** Training sessions: switch sign-up to "no code, admin approves", approve people on the spot, unlock a room that hit a limit. */
export default async function ApprovalsPage() {
  await requireManagerPage();
  const [site, waiting, locked] = await Promise.all([
    getSiteInfo(),
    db.user.findMany({
      where: { pendingApproval: true },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: { id: true, name: true, memberType: true, email: true, username: true, organization: true, gradeLevel: true, phone: true, createdAt: true, memberSchool: { select: { name: true } } },
    }),
    lockedSignIns(),
  ]);
  const minutes = LIMITS.window / 60000;

  return (
    <div className="space-y-5">
      {site.registrationApproval && <AutoRefresh seconds={5} />}
      <div>
        <h1 className="text-2xl font-bold">อนุมัติผู้สมัคร</h1>
        <p className="text-sm text-neutral-500">ใช้ตอนอบรม: เปิดโหมดอบรมแล้วให้ผู้เข้าอบรมสมัครได้เลยโดยไม่ต้องใช้รหัส ผู้สมัครจะขึ้นในรายการนี้ (อัปเดตเองทุก 5 วินาที) ตรวจชื่อ ประเภท และโรงเรียน แล้วกดอนุมัติ ผู้สมัครเข้าสู่ระบบได้ทันที</p>
      </div>

      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <ModeSwitch on={site.registrationApproval} />
        <div className="border-t border-neutral-100 pt-4">
          <UnlockButton locked={locked} />
          <p className="mt-2 text-xs text-neutral-500">
            ระบบกันการเดารหัส: ใส่รหัสผ่านผิดเกิน {LIMITS.loginFailsPerAccount} ครั้งต่อบัญชี หรือ {LIMITS.loginFailsPerIp} ครั้งต่อเครือข่าย · ใส่รหัสสมัครผิดเกิน {LIMITS.codeFailsPerIp} ครั้ง · สมัครเกิน {LIMITS.signupsPerIp} บัญชีต่อเครือข่าย ภายใน {minutes} นาที จะถูกล็อกชั่วคราว
            (ห้องอบรมมักใช้อินเทอร์เน็ตวงเดียวกัน = นับเป็นเครือข่ายเดียว) ถ้ามีคนแจ้งว่าเข้าไม่ได้ทั้งที่รหัสถูก กดปุ่มนี้
          </p>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 p-2">
          <h2 className="font-semibold">รออนุมัติ ({waiting.length.toLocaleString("th-TH")})</h2>
          <ApproveAll ids={waiting.map((u) => u.id)} />
        </div>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-neutral-500">
            <tr><th className="p-2 font-medium">ชื่อ</th><th className="p-2 font-medium">ประเภท</th><th className="p-2 font-medium">โรงเรียน/หน่วยงาน</th><th className="p-2 font-medium">ใช้เข้าสู่ระบบ</th><th className="p-2 font-medium">สมัครเมื่อ</th><th className="p-2" /></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {waiting.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="p-2 font-medium">{u.name}{u.phone && <span className="block text-xs font-normal text-neutral-500">{u.phone}</span>}</td>
                <td className="p-2">{MEMBER_TYPE_LABEL[u.memberType]}{u.gradeLevel && <span className="block text-xs text-neutral-500">ชั้น {u.gradeLevel}</span>}</td>
                <td className="p-2 text-neutral-600">{u.memberSchool?.name ?? u.organization ?? "-"}</td>
                <td className="break-all p-2 text-neutral-600">{u.email ?? u.username}</td>
                <td className="whitespace-nowrap p-2 text-neutral-600">{formatThaiDate(u.createdAt, { time: true })}</td>
                <td className="p-2"><RowButtons id={u.id} name={u.name} /></td>
              </tr>
            ))}
            {waiting.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-neutral-500">{site.registrationApproval ? "ยังไม่มีผู้สมัครที่รออนุมัติ — รายการจะขึ้นเองเมื่อมีคนสมัคร" : "ไม่มีผู้สมัครที่รออนุมัติ"}</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
