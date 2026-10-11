import Link from "next/link";
import LiveFilter from "@/components/live-filter";
import Pager from "@/components/pager";
import { LEARNER_STATUSES, LEARNER_STATUS_LABEL, LEARNERS_PER_PAGE, type LearnerStatus, listLearners } from "@/lib/course/course-learners";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { formatThaiDate } from "@/lib/thai-date";

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

/** Who joined the course and how far they are. Shown to the author and admins only. */
export default async function LearnersTab({ courseId, q, status, page }: { courseId: string; q: string; status: LearnerStatus; page: number }) {
  const { rows, total, pages, counts } = await listLearners(courseId, { q, status, page });
  const base = `/dashboard/courses/${courseId}/edit`;
  const params = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ tab: "learners" });
    if (q) p.set("q", q);
    if (status !== "all") p.set("status", status);
    for (const [k, v] of Object.entries(extra)) { if (v) p.set(k, v); else p.delete(k); }
    return `${base}?${p}`;
  };
  const exportHref = `${base.replace("/edit", "")}/learners/export?${new URLSearchParams({ ...(q && { q }), ...(status !== "all" && { status }) })}`;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["ลงทะเบียน", counts.all], ["เรียนจบแล้ว", counts.done], ["กำลังเรียน", counts.learning], ["ยังไม่เริ่ม", counts.new]] as const).map(([label, n]) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-2xl font-bold tabular-nums">{n.toLocaleString("th-TH")}</p><p className="text-sm text-neutral-600">{label}</p></div>
        ))}
      </div>

      <LiveFilter
        action={base}
        omit={{ status: "all" }}
        className="space-y-4"
        formClassName="grid gap-2 sm:grid-cols-[2fr_1fr]"
        fields={<>
          <input type="hidden" name="tab" value="learners" />
          <input name="q" type="search" defaultValue={q} placeholder="ค้นหาชื่อ โรงเรียน หรือหน่วยงาน" aria-label="ค้นหาผู้เรียน" enterKeyHint="search" className={input} />
          <select name="status" defaultValue={status} aria-label="สถานะการเรียน" className={input}>
            {LEARNER_STATUSES.map((s) => <option key={s} value={s}>{LEARNER_STATUS_LABEL[s]}</option>)}
          </select>
        </>}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-neutral-600" aria-live="polite">พบ {total.toLocaleString("th-TH")} คน</p>
          {total > 0 && <Link href={exportHref} prefetch={false} className="flex min-h-10 items-center rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium hover:border-brand">ดาวน์โหลด Excel</Link>}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-600">{counts.all === 0 ? "ยังไม่มีผู้ลงทะเบียนเรียนคอร์สนี้" : "ไม่พบผู้เรียนที่ตรงกับเงื่อนไข"}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{r.user.name}</p>
                    <p className="break-words text-sm text-neutral-600">{[MEMBER_TYPE_LABEL[r.user.memberType], r.user.memberSchool?.name ?? r.user.organization].filter(Boolean).join(" · ")}</p>
                  </div>
                  {r.completedAt
                    ? <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">เรียนจบ {formatThaiDate(r.completedAt)}</span>
                    : <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">{r.progress > 0 ? "กำลังเรียน" : "ยังไม่เริ่ม"}</span>}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={r.progress} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้า"><div className={`h-full rounded-full ${r.completedAt ? "bg-green-500" : "bg-brand"}`} style={{ width: `${r.progress}%` }} /></div>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums">{r.progress}%</span>
                </div>
                <p className="mt-2 text-xs text-neutral-500">ลงทะเบียน {formatThaiDate(r.createdAt)} · เข้าเรียนล่าสุด {formatThaiDate(r.updatedAt)}</p>
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} pages={pages} href={(p) => params({ page: p > 1 ? String(p) : undefined })} label={`เลือกหน้า (หน้าละ ${LEARNERS_PER_PAGE} คน)`} />
      </LiveFilter>
    </section>
  );
}
