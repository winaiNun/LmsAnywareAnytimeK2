import Link from "next/link";
import { BarChart, Donut } from "@/components/admin/charts";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("th-TH");
const dt = (d: Date) => d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

function StatCard({ label, value, hint, from, to, icon }: { label: string; value: number; hint: string; from: string; to: string; icon: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl p-5 text-white shadow-sm" style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}>
      <svg className="absolute -right-3 -top-3 h-24 w-24 opacity-15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d={icon} /></svg>
      <p className="text-sm text-white/90">{label}</p>
      <p className="mt-1 text-4xl font-bold">{nf.format(value)}</p>
      <p className="mt-2 text-sm text-white/85">{hint}</p>
    </div>
  );
}

const Card = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <section className="rounded-xl bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

export default async function AdminDashboard() {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86400000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [users, newUsers, books, copies, courses, publishedCourses, activeLoans, overdueLoans, returnedLoans, enrollments, recentUsers, latestLoans, memberDates, courseStats] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: since30 } } }),
      db.book.count(),
      db.bookCopy.count(),
      db.course.count(),
      db.course.count({ where: { published: true } }),
      db.loan.count({ where: { returnedAt: null } }),
      db.loan.count({ where: { returnedAt: null, dueAt: { lt: now } } }),
      db.loan.count({ where: { returnedAt: { not: null } } }),
      db.enrollment.count(),
      db.user.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      db.loan.findMany({ orderBy: { borrowedAt: "desc" }, take: 6, include: { user: true, copy: { include: { book: true } } } }),
      db.user.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
      db.enrollment.groupBy({ by: ["courseId"], _count: { _all: true }, _avg: { progress: true }, orderBy: { _count: { courseId: "desc" } }, take: 5 }),
    ]);

  const courseTitles = new Map((await db.course.findMany({ where: { id: { in: courseStats.map((c) => c.courseId) } } })).map((c) => [c.id, c.title]));

  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const monthly = months.map((m) => ({
    label: m.toLocaleDateString("th-TH", { month: "short" }),
    value: memberDates.filter((u) => u.createdAt.getFullYear() === m.getFullYear() && u.createdAt.getMonth() === m.getMonth()).length,
  }));

  const onTime = activeLoans - overdueLoans;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
        <p className="text-sm text-neutral-500">ภาพรวมระบบห้องสมุดและการเรียนรู้</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="สมาชิกทั้งหมด" value={users} hint={`ใหม่ใน 30 วัน +${newUsers}`} from="#FF5A1F" to="#F04438" icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <StatCard label="สื่อการเรียนรู้" value={books} hint={`${nf.format(copies)} เล่ม/ชุด`} from="#2DD4A0" to="#17B26A" icon="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7" />
        <StatCard label="คอร์สเรียน" value={courses} hint={`เปิดแล้ว ${publishedCourses} คอร์ส`} from="#FF5C8A" to="#F43F5E" icon="M5 3l14 9-14 9z" />
        <StatCard label="กำลังยืมอยู่" value={activeLoans} hint={`เกินกำหนด ${overdueLoans} รายการ`} from="#FBBF24" to="#F59E0B" icon="M3 5h18v14H3zM3 10h18" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="สมาชิกใหม่ 6 เดือนล่าสุด">
            <BarChart data={monthly} />
          </Card>
        </div>
        <Card title="สถานะการยืมหนังสือ">
          <Donut
            centerValue={String(activeLoans + returnedLoans)}
            centerLabel="รายการทั้งหมด"
            segments={[
              { label: "กำลังยืม", value: onTime, color: "#0052FF" },
              { label: "เกินกำหนด", value: overdueLoans, color: "#F04438" },
              { label: "คืนแล้ว", value: returnedLoans, color: "#17B26A" },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="การยืมล่าสุด" action={<Link href="/admin/books" className="text-sm text-brand">ดูสื่อทั้งหมด</Link>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-neutral-500">
                  <tr><th className="pb-2 font-medium">สื่อ/หนังสือ</th><th className="pb-2 font-medium">ผู้ยืม</th><th className="pb-2 font-medium">วันที่ยืม</th><th className="pb-2 font-medium">สถานะ</th></tr>
                </thead>
                <tbody>
                  {latestLoans.map((l) => {
                    const overdue = !l.returnedAt && l.dueAt < now;
                    const [label, cls] = l.returnedAt ? ["คืนแล้ว", "bg-green-50 text-green-700"] : overdue ? ["เกินกำหนด", "bg-red-50 text-red-600"] : ["กำลังยืม", "bg-blue-50 text-brand"];
                    return (
                      <tr key={l.id} className="border-t border-neutral-100">
                        <td className="py-3 font-medium">{l.copy.book.title}</td>
                        <td className="py-3 text-neutral-600">{l.user.name}</td>
                        <td className="py-3 text-neutral-600">{dt(l.borrowedAt)}</td>
                        <td className="py-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card title="คอร์สยอดนิยม" action={<Link href="/admin/courses" className="text-sm text-brand">ทั้งหมด</Link>}>
          <ul className="space-y-4">
            {courseStats.map((c) => {
              const avg = Math.round(c._avg.progress ?? 0);
              return (
                <li key={c.courseId} className="space-y-1.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{courseTitles.get(c.courseId)}</span>
                    <span className="shrink-0 text-neutral-500">{c._count._all} คน</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100" role="progressbar" aria-valuenow={avg} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้าเฉลี่ย">
                    <div className="h-2 rounded-full bg-brand" style={{ width: `${avg}%` }} />
                  </div>
                  <p className="text-xs text-neutral-500">ความคืบหน้าเฉลี่ย {avg}%</p>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="การลงทะเบียนเรียนทั้งหมด"><p className="text-3xl font-bold">{nf.format(enrollments)}</p><p className="text-sm text-neutral-500">ครั้ง ในทุกคอร์ส</p></Card>
        <Card title="อัตราคืนตรงเวลา">
          <p className="text-3xl font-bold">{activeLoans + returnedLoans ? Math.round(((returnedLoans + onTime) / (activeLoans + returnedLoans)) * 100) : 0}%</p>
          <p className="text-sm text-neutral-500">ไม่นับรายการเกินกำหนด</p>
        </Card>
        <Card title="สมาชิกล่าสุด">
          <ul className="space-y-2 text-sm">
            {recentUsers.map((u) => (
              <li key={u.id} className="flex justify-between gap-2"><span className="truncate">{u.name}</span><span className="shrink-0 text-neutral-500">{dt(u.createdAt)}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
