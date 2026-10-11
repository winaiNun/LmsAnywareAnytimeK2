import Link from "next/link";
import { requireManagerPage } from "@/lib/permissions";
import { BarChart, Donut } from "@/components/admin/charts";
import { db } from "@/lib/db";
import { THAI_MONTHS_SHORT, formatThaiDate, lastMonthsBangkok } from "@/lib/thai-date";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("th-TH");
const dt = (d: Date) => formatThaiDate(d);

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
  await requireManagerPage();
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86400000);
  // Month buckets are Bangkok calendar months, not the server's (a sign-up at 00:30 on the 1st counts for that month).
  const months = lastMonthsBangkok(6, now);
  const sixMonthsAgo = months[0].start;

  const [users, newUsers, mediaPublished, mediaPending, courses, publishedCourses, enrollments, recentUsers, memberDates, courseStats, totals, areas, topMedia, pendingMedia] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: since30 } } }),
      db.media.count({ where: { status: "PUBLISHED" } }),
      db.media.count({ where: { status: "PENDING" } }),
      db.course.count(),
      db.course.count({ where: { published: true } }),
      db.enrollment.count(),
      db.user.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      db.user.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
      db.enrollment.groupBy({ by: ["courseId"], _count: { _all: true }, _avg: { progress: true }, orderBy: { _count: { courseId: "desc" } }, take: 5 }),
      db.media.aggregate({ where: { status: "PUBLISHED" }, _sum: { viewCount: true, likeCount: true, downloadCount: true } }),
      db.learningArea.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, color: true, _count: { select: { media: { where: { status: "PUBLISHED" } } } } } }),
      db.media.findMany({ where: { status: "PUBLISHED" }, orderBy: { viewCount: "desc" }, take: 5, select: { id: true, title: true, viewCount: true, likeCount: true } }),
      db.media.findMany({ where: { status: "PENDING" }, orderBy: { updatedAt: "asc" }, take: 5, select: { id: true, title: true, updatedAt: true, createdBy: { select: { name: true } } } }),
    ]);

  const courseTitles = new Map((await db.course.findMany({ where: { id: { in: courseStats.map((c) => c.courseId) } } })).map((c) => [c.id, c.title]));

  const monthly = months.map((m) => ({
    label: THAI_MONTHS_SHORT[m.month - 1],
    value: memberDates.filter((u) => u.createdAt >= m.start && u.createdAt < m.end).length,
  }));
  const views = totals._sum.viewCount ?? 0;
  const likes = totals._sum.likeCount ?? 0;
  const downloads = totals._sum.downloadCount ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
        <p className="text-sm text-neutral-500">ภาพรวมคลังสื่อและการเรียนรู้</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="สมาชิกทั้งหมด" value={users} hint={`ใหม่ใน 30 วัน +${newUsers}`} from="#FF5A1F" to="#F04438" icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        <StatCard label="สื่อที่เผยแพร่" value={mediaPublished} hint={mediaPending > 0 ? `รออนุมัติ ${mediaPending} ชิ้น` : "ไม่มีรายการรออนุมัติ"} from="#2DD4A0" to="#17B26A" icon="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7" />
        <StatCard label="ยอดเปิดดูสื่อ" value={views} hint={`ถูกใจ ${nf.format(likes)} · ดาวน์โหลด/เปิดลิงก์ ${nf.format(downloads)}`} from="#FBBF24" to="#F59E0B" icon="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <StatCard label="คอร์สเรียน" value={courses} hint={`เปิดแล้ว ${publishedCourses} คอร์ส`} from="#FF5C8A" to="#F43F5E" icon="M5 3l14 9-14 9z" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="สมาชิกใหม่ 6 เดือนล่าสุด">
            <BarChart data={monthly} />
          </Card>
        </div>
        <Card title="สื่อแยกตามกลุ่มสาระ">
          <Donut
            centerValue={String(mediaPublished)}
            centerLabel="สื่อที่เผยแพร่"
            segments={areas.filter((a) => a._count.media > 0).map((a) => ({ label: a.name, value: a._count.media, color: a.color }))}
          />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="สื่อที่ถูกเปิดดูมากที่สุด" action={<Link href="/admin/media" className="text-sm text-brand">จัดการสื่อ</Link>}>
            {topMedia.length === 0 ? (
              <p className="text-sm text-neutral-500">ยังไม่มีสื่อที่เผยแพร่</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="text-neutral-500"><tr><th className="pb-2 font-medium">สื่อ</th><th className="pb-2 font-medium">เปิดดู</th><th className="pb-2 font-medium">ถูกใจ</th></tr></thead>
                  <tbody>
                    {topMedia.map((m) => (
                      <tr key={m.id} className="border-t border-neutral-100">
                        <td className="py-3 font-medium"><Link href={`/library/${m.id}`} className="hover:text-brand">{m.title}</Link></td>
                        <td className="py-3 tabular-nums text-neutral-600">{nf.format(m.viewCount)}</td>
                        <td className="py-3 tabular-nums text-neutral-600">{nf.format(m.likeCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title="รออนุมัติ" action={<Link href="/admin/media?status=PENDING" className="text-sm text-brand">ดูทั้งหมด</Link>}>
          {pendingMedia.length === 0 ? (
            <p className="text-sm text-neutral-500">ไม่มีสื่อรออนุมัติ</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {pendingMedia.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/media/${m.id}`} className="block font-medium hover:text-brand">{m.title}</Link>
                  <span className="text-xs text-neutral-500">{m.createdBy.name} · ส่งเมื่อ {dt(m.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
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
        <Card title="การลงทะเบียนเรียนทั้งหมด"><p className="text-3xl font-bold">{nf.format(enrollments)}</p><p className="text-sm text-neutral-500">ครั้ง ในทุกคอร์ส</p></Card>
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
