import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canEditCourse } from "@/lib/course/access";
import { audienceLabels } from "@/lib/course/course-data";
import { getCourseReport, type GroupRow, type SchoolRow } from "@/lib/course/course-report";
import { getCourseActor } from "@/lib/course/course-server";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายงานรายโรงเรียน" };

const nf = new Intl.NumberFormat("th-TH");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function Bar({ joined, completed, population }: { joined: number; completed: number; population: number }) {
  return (
    <div className="w-36 space-y-1" role="img" aria-label={`ลงเรียน ${pct(joined, population)}% เรียนจบ ${pct(completed, population)}%`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-brand/40" style={{ width: `${pct(joined, population)}%` }} /></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-green-600" style={{ width: `${pct(completed, population)}%` }} /></div>
    </div>
  );
}

const Num = ({ n }: { n: number }) => <td className="p-2 tabular-nums">{nf.format(n)}</td>;

/** School-by-school progress of the people a course is for. Counts only (no names): the owner and admins have the individual list in the learners tab. */
export default async function CourseReportPage({ params, searchParams }: { params: { id: string }; searchParams: { only?: string } }) {
  const actor = await getCourseActor();
  if (!actor) redirect(`/login?callbackUrl=/dashboard/courses/${params.id}/report`);
  const r = await getCourseReport(params.id);
  if (!r || !canEditCourse(actor, { createdById: r.course.createdById })) notFound();
  const onlyNotStarted = searchParams.only === "notstarted";
  const schools: SchoolRow[] = r.schools.filter((s) => s.population > 0 && (!onlyNotStarted || s.joined === 0));
  const noMembers = r.schools.filter((s) => s.population === 0).length;
  const t = r.totals;
  const groupTable = (title: string, rows: GroupRow[]) => (
    <section className="overflow-x-auto rounded-2xl bg-white p-3 shadow-sm">
      <h2 className="px-2 pb-2 font-semibold">{title}</h2>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs text-neutral-500">
          <tr>
            <th className="p-2 font-medium">กลุ่ม</th><th className="p-2 font-medium">โรงเรียนที่มีสมาชิก</th><th className="p-2 font-medium">สมาชิกในกลุ่ม</th>
            <th className="p-2 font-medium">ลงเรียน</th><th className="p-2 font-medium">เรียนจบ</th><th className="p-2 font-medium">ความคืบหน้า</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.name} className="border-t border-neutral-100">
              <td className="p-2 font-medium">{g.name}</td>
              <td className="p-2 tabular-nums">{g.schoolsWithMembers}/{g.schools}{g.schoolsNotStarted > 0 && <span className="ml-1 text-xs text-amber-700">(ยังไม่มีใครลงเรียน {g.schoolsNotStarted})</span>}</td>
              <Num n={g.population} /><Num n={g.joined} /><Num n={g.completed} />
              <td className="p-2"><Bar joined={g.joined} completed={g.completed} population={g.population} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
  const base = `/dashboard/courses/${r.course.id}/report`;

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <Link href={`/dashboard/courses/${r.course.id}/edit?tab=learners`} className="text-sm text-brand">← กลับไปแท็บผู้เรียน</Link>
        <h1 className="mt-1 text-2xl font-bold">รายงานรายโรงเรียน</h1>
        <p className="text-neutral-600">{r.course.title}</p>
        <p className="mt-1 text-sm text-neutral-500">
          กลุ่มที่นับ: {r.course.defaultAudience ? "สมาชิกทุกประเภทที่ไม่ใช่นักเรียน (คอร์สนี้ไม่ได้กำหนดกลุ่มเป้าหมาย)" : audienceLabels(r.course.audience).join(" · ")}
          {r.course.mandatory && " · คอร์สบังคับ"}{r.course.dueAt && ` · กำหนดส่ง ${formatThaiDate(r.course.dueAt, { style: "medium" })}`}
          {" "}· นับเป็นจำนวนรวมเท่านั้น ไม่แสดงชื่อรายบุคคล
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["สมาชิกในกลุ่มนี้ทั้งหมด", nf.format(t.population), ""],
          ["ลงทะเบียนเรียนแล้ว", nf.format(t.joined), `${pct(t.joined, t.population)}% ของกลุ่ม`],
          ["เรียนจบแล้ว", nf.format(t.completed), `${pct(t.completed, t.population)}% ของกลุ่ม`],
          ["จบหลังกำหนด", r.course.dueAt ? nf.format(t.late) : "—", r.course.dueAt ? "" : "คอร์สนี้ไม่มีกำหนดส่ง"],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <dt className="text-xs text-neutral-500">{label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
            {hint && <p className="text-xs text-neutral-500">{hint}</p>}
          </div>
        ))}
      </dl>

      {r.centers.length > 0 && groupTable("แยกตามศูนย์เครือข่าย", r.centers)}
      {r.districts.length > 0 && groupTable("แยกตามอำเภอ", r.districts)}

      <section className="overflow-x-auto rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
          <h2 className="font-semibold">แยกตามโรงเรียน ({schools.length})</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={onlyNotStarted ? base : `${base}?only=notstarted`} className={`rounded-full border px-3 py-1.5 ${onlyNotStarted ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>เฉพาะโรงเรียนที่ยังไม่มีใครลงเรียน</Link>
            <a href={`${base}/export`} className="rounded-full border border-neutral-300 px-3 py-1.5">ส่งออก .xlsx</a>
          </div>
        </div>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-neutral-500">
            <tr>
              <th className="p-2 font-medium">โรงเรียน</th><th className="p-2 font-medium">อำเภอ / ศูนย์</th><th className="p-2 font-medium">สมาชิก</th>
              <th className="p-2 font-medium">ลงเรียน</th><th className="p-2 font-medium">เรียนจบ</th><th className="p-2 font-medium">ความคืบหน้า</th>
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.schoolId} className="border-t border-neutral-100">
                <td className="p-2 font-medium">{s.name}</td>
                <td className="p-2 text-neutral-600">อ.{s.district} · {s.center}</td>
                <Num n={s.population} /><Num n={s.joined} /><Num n={s.completed} />
                <td className="p-2"><Bar joined={s.joined} completed={s.completed} population={s.population} /></td>
              </tr>
            ))}
            {r.other && !onlyNotStarted && (
              <tr className="border-t border-neutral-100 bg-neutral-50">
                <td className="p-2 font-medium">{r.other.name}</td><td className="p-2 text-neutral-500">—</td>
                <Num n={r.other.population} /><Num n={r.other.joined} /><Num n={r.other.completed} />
                <td className="p-2"><Bar joined={r.other.joined} completed={r.other.completed} population={r.other.population} /></td>
              </tr>
            )}
            {schools.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-500">{onlyNotStarted ? "ทุกโรงเรียนที่มีสมาชิกมีคนลงเรียนแล้ว" : "ยังไม่มีสมาชิกในกลุ่มนี้"}</td></tr>}
          </tbody>
        </table>
        <p className="px-2 pt-2 text-xs text-neutral-500">มี {nf.format(noMembers)} โรงเรียนที่ยังไม่มีสมาชิกในกลุ่มนี้สมัครเลย (ไม่แสดงในตาราง) — แจ้งโรงเรียนเหล่านั้นให้ขอรหัสสมัครจากผู้ดูแลระบบ</p>
      </section>
    </main>
  );
}
