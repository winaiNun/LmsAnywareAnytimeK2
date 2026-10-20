import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import SchoolCard from "@/components/school-card";
import SiteNavbar from "@/components/site-navbar";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { storageIsDurable, toListItem } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";
import { formatThaiDate } from "@/lib/thai-date";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { audienceLabels } from "@/lib/course/course-data";
import { getSchoolSummary } from "@/lib/school-summary";
import SchoolPortalForm from "./portal-form";

const nf = new Intl.NumberFormat("th-TH");

export const dynamic = "force-dynamic";

export default async function SchoolPortalPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/school");

  const [school, site] = await Promise.all([db.school.findUnique({ where: { accountId: session.user.id } }), getSiteInfo()]);
  const summary = school ? await getSchoolSummary(school.id) : null;

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-4xl space-y-6 px-4 pb-28 pt-24 md:pb-16">
        {!school ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <h1 className="text-xl font-bold">บัญชีนี้ไม่ได้เชื่อมกับโรงเรียนใด</h1>
            <Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white">ไปที่บัญชีของฉัน</Link>
          </div>
        ) : (
          <>
            <header className="space-y-1">
              <p className="text-sm text-neutral-500">โรงเรียนของฉัน</p>
              <h1 className="text-2xl font-bold sm:text-3xl">{school.name}</h1>
              <p className="text-neutral-600">รหัส {school.code} · อ.{school.district} · {school.center}{school.updatedAt ? ` · แก้ล่าสุด ${formatThaiDate(school.updatedAt, { time: true })}` : ""}</p>
              {!school.active && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">โรงเรียนของคุณถูกปิดการแสดงผลชั่วคราว ติดต่อผู้ดูแลระบบหากต้องการเปิดอีกครั้ง</p>}
            </header>

            {summary && (
              <section aria-label="สรุปของโรงเรียน" className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold">สรุปของโรงเรียน</h2>
                  <p className="text-sm text-neutral-500">นับจากสมาชิกที่เลือกโรงเรียนนี้ตอนสมัคร · แสดงเป็นจำนวนรวมเท่านั้น ไม่แสดงรายชื่อหรือผลของรายบุคคล (และไม่แสดงรายชื่อนักเรียน)</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    ["ครูและบุคลากรที่สมัคร", summary.adults],
                    ["นักเรียนที่สมัคร", summary.students],
                    ["สื่อที่เผยแพร่แล้ว", summary.mediaPublished],
                    ["คอร์สที่สร้าง", summary.coursesPublished],
                    ["เกียรติบัตรที่ได้รับ (ครู/บุคลากร)", summary.certificates],
                    ["นักเรียนที่ลงเรียนคอร์ส", summary.studentLearners],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-2xl bg-white p-4 shadow-sm">
                      <dt className="text-xs text-neutral-500">{label}</dt>
                      <dd className="mt-1 text-2xl font-bold tabular-nums">{nf.format(value as number)}</dd>
                    </div>
                  ))}
                </dl>
                {summary.members.length > 0 ? (
                  <p className="flex flex-wrap gap-2 text-sm">{summary.members.map((m) => <span key={m.type} className="rounded-full bg-brand-soft px-3 py-1 text-brand">{MEMBER_TYPE_LABEL[m.type]} {nf.format(m.count)} คน</span>)}</p>
                ) : (
                  <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-sm text-neutral-600">ยังไม่มีสมาชิกที่สมัครในนามโรงเรียนนี้ — แจ้งให้ครูและบุคลากรขอรหัสสมัครจากผู้ดูแลระบบของเขตพื้นที่ แล้วสมัครโดยเลือกโรงเรียนของท่าน</p>
                )}
                {summary.courses.length > 0 && (
                  <div className="overflow-x-auto rounded-2xl bg-white p-3 shadow-sm">
                    <h3 className="px-2 pb-2 font-semibold">คอร์สที่ครูและบุคลากรของโรงเรียนลงเรียน</h3>
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="text-xs text-neutral-500"><tr><th className="p-2 font-medium">คอร์ส</th><th className="p-2 font-medium">ลงเรียน</th><th className="p-2 font-medium">เรียนจบ</th><th className="p-2 font-medium">ความคืบหน้า</th></tr></thead>
                      <tbody>
                        {summary.courses.map((c) => (
                          <tr key={c.id} className="border-t border-neutral-100">
                            <td className="p-2"><Link href={`/courses/${c.id}`} className="font-medium text-brand hover:underline">{c.title}</Link>{c.audience.length > 0 && <span className="block text-xs text-neutral-500">สำหรับ {audienceLabels(c.audience).join(" · ")}</span>}</td>
                            <td className="p-2 tabular-nums">{nf.format(c.enrolled)}</td>
                            <td className="p-2 tabular-nums">{nf.format(c.completed)}</td>
                            <td className="w-40 p-2"><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((c.completed / Math.max(1, c.enrolled)) * 100)}%` }} /></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            <div className="grid gap-6 md:grid-cols-5">
              <section className="space-y-3 md:col-span-2" aria-label="ตัวอย่างที่แสดงบนเว็บ">
                <h2 className="font-semibold">การ์ดที่แสดงบนหน้าเว็บ</h2>
                <SchoolCard school={toListItem(school)} />
                <Link href={`/schools?q=${school.code}`} className="text-sm text-brand">ดูในหน้าทำเนียบโรงเรียน →</Link>
              </section>
              <section className="md:col-span-3">
                <SchoolPortalForm siteUrl={school.siteUrl ?? ""} cardSourceUrl={school.cardSourceUrl ?? ""} cardUrl={toListItem(school).cardUrl} allowUpload={storageIsDurable() && site.allowServerUploads} cardError={school.cardStatus === "failed" ? school.cardError : null} />
              </section>
            </div>

            <p className="text-sm text-neutral-500">ชื่อโรงเรียน อำเภอ และศูนย์เครือข่าย แก้ไขได้โดยผู้ดูแลระบบเท่านั้น · <Link href="/account/password" className="text-brand">เปลี่ยนรหัสผ่าน</Link></p>
          </>
        )}
      </main>
    </>
  );
}
