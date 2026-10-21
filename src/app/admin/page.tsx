import Link from "next/link";
import { audienceLabels } from "@/lib/course/course-data";
import { BarChart, Donut } from "@/components/admin/charts";
import Glyph, { IconTile } from "@/components/glyph";
import { getAudienceCourses, getDashboard, getEngagement, getReadiness, type Alert } from "@/lib/admin-stats";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { THAI_MONTHS_SHORT, formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
export const metadata = { title: "แดชบอร์ด" };

const nf = new Intl.NumberFormat("th-TH");
const TYPE_COLOR = { STUDENT: "#0052FF", TEACHER: "#17B26A", SCHOOL_ADMIN: "#0891B2", SUPERVISOR: "#F59E0B", DISTRICT_STAFF: "#DC2626", GENERAL: "#7C3AED" } as const;

function Stat({ icon, color, label, value, hint, progress }: { icon: string; color: string; label: string; value: string; hint?: React.ReactNode; progress?: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-neutral-500">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        </div>
        <IconTile name={icon} color={color} size={46} />
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, progress)}%`, backgroundColor: color }} />
        </div>
      )}
      {hint && <p className="mt-2 text-sm text-neutral-500">{hint}</p>}
    </div>
  );
}

const Card = ({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <section className={`min-w-0 rounded-2xl bg-white p-5 shadow-sm ${className}`}>
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const more = (href: string, text = "ดูทั้งหมด") => (
  <Link href={href} className="inline-flex items-center gap-0.5 text-sm font-medium text-brand hover:underline">{text}<Glyph name="chevron-right" size={14} strokeWidth={2.2} /></Link>
);

/** Horizontal bars: label, bar, value (the bar is relative to the largest row). */
function Bars({ rows, empty = "ยังไม่มีข้อมูล" }: { rows: { label: string; value: number; color?: string; suffix?: string }[]; empty?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (rows.length === 0 || rows.every((r) => r.value === 0)) return <p className="text-sm text-neutral-500">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
          <span className="truncate text-neutral-700" title={r.label}>{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color ?? "#0052FF" }} /></span>
          <span className="min-w-12 text-right tabular-nums text-neutral-600">{nf.format(r.value)}{r.suffix}</span>
        </li>
      ))}
    </ul>
  );
}

const ALERT_STYLE: Record<Alert["level"], { bar: string; tone: string }> = {
  danger: { bar: "bg-red-500", tone: "text-red-700" },
  warn: { bar: "bg-amber-500", tone: "text-amber-800" },
  info: { bar: "bg-brand", tone: "text-neutral-700" },
};

export default async function AdminDashboard() {
  const me = await requireManagerPage();
  const admin = isAdmin(me.role);
  const [d, readiness, engagement, audienceCourses] = await Promise.all([getDashboard(), admin ? getReadiness() : Promise.resolve([]), getEngagement(), getAudienceCourses()]);
  const notReady = readiness.filter((c) => !c.ok);
  const monthly = d.members.monthly.map((m) => ({ label: THAI_MONTHS_SHORT[m.month - 1], value: m.value }));
  const daily = d.media.dailyViews.map((x) => ({ label: String(x.day), value: x.value }));
  const schoolPct = d.schools.withAccount ? (d.schools.activated / d.schools.withAccount) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
          <p className="text-sm text-neutral-500">ภาพรวมของระบบตามข้อมูลจริง ณ วันที่ {formatThaiDate(new Date(), { style: "long" })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/media/new" className="flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"><Glyph name="file-text" size={18} />เพิ่มสื่อ</Link>
          {admin && <Link href="/admin/registration-codes" className="flex min-h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium hover:bg-neutral-50"><Glyph name="users" size={18} />รหัสสมัคร</Link>}
          {admin && <Link href="/admin/users/import" className="flex min-h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium hover:bg-neutral-50"><Glyph name="download" size={18} />นำเข้าสมาชิก</Link>}
        </div>
      </div>

      <section aria-label="สิ่งที่ต้องดำเนินการ" className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">ต้องดำเนินการ {d.alerts.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{d.alerts.length}</span>}</h2>
        {d.alerts.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800"><Glyph name="check" size={18} strokeWidth={2.4} />ไม่มีเรื่องค้าง ทุกอย่างเรียบร้อย</p>
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {d.alerts.map((a) => {
              const st = ALERT_STYLE[a.level];
              return (
                <li key={a.text} className="flex items-stretch overflow-hidden rounded-xl border border-neutral-200">
                  <span className={`w-1.5 shrink-0 ${st.bar}`} aria-hidden />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5">
                    <p className={`text-sm leading-snug ${st.tone}`}>{a.text}</p>
                    <Link href={a.href} className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50">{a.action}</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {notReady.length > 0 && (
        <section aria-label="ความพร้อมก่อนใช้งานจริง" className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="mb-1 font-semibold">ความพร้อมก่อนเปิดใช้งานจริง <span className="ml-1 text-sm font-normal text-neutral-600">ผ่าน {readiness.length - notReady.length} จาก {readiness.length} ข้อ</span></h2>
          <p className="mb-3 text-sm text-neutral-600">สิ่งที่มักลืมก่อนเปิดให้คนจริงใช้ — หายไปจากรายการนี้เองเมื่อแก้แล้ว (เห็นเฉพาะผู้ดูแลระบบ)</p>
          <ul className="grid gap-2 lg:grid-cols-2">
            {notReady.map((c) => {
              const st = ALERT_STYLE[c.level];
              return (
                <li key={c.text} className="flex items-stretch overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  <span className={`w-1.5 shrink-0 ${st.bar}`} aria-hidden />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5">
                    <p className={`text-sm leading-snug ${st.tone}`}>{c.text}</p>
                    <Link href={c.href} className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50">{c.action}</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <Stat icon="users" color="#F04438" label="สมาชิกทั้งหมด" value={nf.format(d.members.total)} hint={<>ใหม่ใน 30 วัน <strong className="text-neutral-800">+{nf.format(d.members.new30)}</strong></>} />
        <Stat icon="book-open" color="#17B26A" label="สื่อที่เผยแพร่" value={nf.format(d.media.published)} hint={d.media.pending > 0 ? <>รออนุมัติ <strong className="text-amber-700">{d.media.pending}</strong> · ร่าง {d.media.draft}</> : <>ร่าง {d.media.draft} · ส่งกลับ {d.media.rejected}</>} />
        <Stat icon="play-circle" color="#7C3AED" label="คอร์สที่เผยแพร่" value={nf.format(d.courses.published)} hint={d.courses.pending > 0 ? <>รออนุมัติ <strong className="text-amber-700">{d.courses.pending}</strong> · ผู้เรียน {nf.format(d.courses.learners)}</> : <>ผู้เรียน {nf.format(d.courses.learners)} · เรียนจบ {nf.format(d.courses.completed)}</>} />
        <Stat icon="eye" color="#F59E0B" label="เปิดดูสื่อ 30 วันล่าสุด" value={nf.format(d.media.views30)} hint={<>รวมทั้งหมด {nf.format(d.media.views)} · ถูกใจ {nf.format(d.media.likes)} · เปิดลิงก์ {nf.format(d.media.downloads)}</>} />
        <Stat icon="app-window" color="#0052FF" label="โรงเรียนที่เข้าใช้บัญชีแล้ว" value={`${nf.format(d.schools.activated)} / ${nf.format(d.schools.withAccount)}`} progress={schoolPct} hint={`จากทำเนียบ ${nf.format(d.schools.total)} โรงเรียน`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="โรงเรียนที่มีครู/บุคลากรสมัครแล้ว" action={more("/admin/schools", "โรงเรียน")}>
          <p className="mb-1 text-3xl font-bold tabular-nums">{nf.format(engagement.schools.covered)} <span className="text-base font-normal text-neutral-500">/ {nf.format(engagement.schools.total)} โรงเรียน</span></p>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={Math.round((engagement.schools.covered / Math.max(1, engagement.schools.total)) * 100)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-brand" style={{ width: `${(engagement.schools.covered / Math.max(1, engagement.schools.total)) * 100}%` }} /></div>
          <Bars
            rows={engagement.districts.slice(0, 6).map((x) => ({ label: `อ.${x.district}`, value: Math.round((x.covered / Math.max(1, x.total)) * 100), suffix: `% (${x.covered}/${x.total})`, color: "#17B26A" }))}
            empty="ยังไม่มีข้อมูลโรงเรียน"
          />
          <p className="mt-3 text-xs text-neutral-500">นับโรงเรียนที่มีสมาชิกประเภทครู/ผู้บริหาร/บุคลากรอย่างน้อย 1 คน — โรงเรียนที่ยังเป็น 0 คือกลุ่มที่ควรเชิญชวนก่อน</p>
        </Card>
        <Card title="คอร์สที่สร้างให้กลุ่มเป้าหมาย" className="xl:col-span-2" action={more("/admin/courses", "คอร์สทั้งหมด")}>
          {audienceCourses.length === 0 ? (
            <p className="text-sm text-neutral-500">ยังไม่มีคอร์สที่กำหนดกลุ่มเป้าหมาย — ตั้งได้ในแท็บ “ข้อมูลคอร์ส” (เช่น คอร์สสำหรับผู้บริหารสถานศึกษา) แล้วดูความคืบหน้าของกลุ่มนั้นที่นี่</p>
          ) : (
            <ul className="space-y-4 text-sm">
              {audienceCourses.map((c) => (
                <li key={c.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-3"><Link href={`/courses/${c.id}`} className="font-medium hover:text-brand">{c.title}</Link><Link href={`/dashboard/courses/${c.id}/report`} className="shrink-0 text-xs font-medium text-brand hover:underline">รายงานรายโรงเรียน</Link></span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">{c.mandatory && <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">บังคับ</span>}{c.dueAt && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">ภายใน {formatThaiDate(c.dueAt, { style: "medium" })}</span>}{c.only ? "เปิดเฉพาะ" : "แนะนำสำหรับ"} {audienceLabels(c.audience).join(" · ")}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-[1fr_auto] items-center gap-3">
                    <div className="space-y-1">
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100" title="ลงเรียนแล้ว"><div className="h-full rounded-full bg-brand/40" style={{ width: `${Math.min(100, (c.joined / Math.max(1, c.population)) * 100)}%` }} /></div>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100" title="เรียนจบแล้ว"><div className="h-full rounded-full bg-green-600" style={{ width: `${Math.min(100, (c.completed / Math.max(1, c.population)) * 100)}%` }} /></div>
                    </div>
                    <p className="text-right text-xs tabular-nums text-neutral-600">ลงเรียน {nf.format(c.joined)} · จบ {nf.format(c.completed)}<br />จากกลุ่มนี้ทั้งหมด {nf.format(c.population)} คน</p>
                  </div>
                  {c.others > 0 && <p className="mt-0.5 text-xs text-neutral-500">มีผู้เรียนนอกกลุ่มเป้าหมายอีก {nf.format(c.others)} คน</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="เชิดชูผู้สร้าง — ความยินยอม" action={more("/admin/honors", "จัดการ")}>
          <p className="text-3xl font-bold tabular-nums">{nf.format(engagement.honors.consenting)} <span className="text-base font-normal text-neutral-500">/ {nf.format(engagement.honors.adults)} คน ที่ยินยอมแสดงตัว</span></p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${(engagement.honors.consenting / Math.max(1, engagement.honors.adults)) * 100}%` }} /></div>
          <p className="mt-3 text-xs text-neutral-500">นับสมาชิกที่ไม่ใช่นักเรียน · ถูกผู้ดูแลซ่อน {nf.format(engagement.honors.hidden)} คน · ยิ่งมีคนยินยอมมาก หน้าเชิดชูยิ่งช่วยกระตุ้นให้คนอื่นสร้างผลงาน</p>
        </Card>
        <Card title="ผู้เข้าชมเว็บไซต์ 14 วันล่าสุด" className="xl:col-span-2" action={more("/admin/pages", "ตั้งค่าตัวนับ")}>
          <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
            {[["วันนี้", d.visits.today], ["เดือนนี้", d.visits.month], ["ทั้งหมด", d.visits.total]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl bg-neutral-50 px-3 py-2"><p className="text-xs text-neutral-500">{l}</p><p className="text-xl font-bold tabular-nums">{nf.format(v as number)}</p></div>
            ))}
          </div>
          <BarChart data={d.visits.daily.map((x) => ({ label: String(x.day), value: x.value }))} color="#0052FF" />
          <p className="mt-2 text-xs text-neutral-500">ผู้เข้าชมไม่ซ้ำรายวัน (นับตั้งแต่ {formatThaiDate(new Date(d.visits.since), { style: "long" })})</p>
        </Card>
        <Card title="แหล่งสื่อภายนอก" action={more("/admin/resources", "จัดการ")}>
          <p className="text-sm text-neutral-600">เพิ่มเว็บ/ช่องทางที่แนะนำให้ครูและนักเรียน แสดงที่หน้าแรก ท้ายเว็บ และหน้า “แหล่งสื่อภายนอก”</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="เปิดดูสื่อ 14 วันล่าสุด" className="xl:col-span-2" action={more("/admin/media", "จัดการสื่อ")}>
          <BarChart data={daily} color="#F59E0B" />
        </Card>
        <Card title="สมาชิกตามประเภท" action={admin ? more("/admin/users") : undefined}>
          <Donut centerValue={nf.format(d.members.total)} centerLabel="สมาชิกทั้งหมด" segments={d.members.byType.map((t) => ({ label: t.label, value: t.value, color: TYPE_COLOR[t.type] }))} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="สมาชิกใหม่ 6 เดือนล่าสุด">
          <BarChart data={monthly} />
        </Card>
        <Card title="สื่อตามกลุ่มสาระ" className="xl:col-span-2" action={more("/admin/media-taxonomy", "กลุ่มสาระและผู้ตรวจ")}>
          <Bars rows={d.media.areas.map((a) => ({ label: a.name, value: a.count, color: a.color }))} empty="ยังไม่มีสื่อที่เผยแพร่" />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="สื่อที่ถูกดูมาก (30 วัน)" action={more("/library?sort=views", "ดูในเว็บ")}>
          {d.media.top.length === 0 ? <p className="text-sm text-neutral-500">ยังไม่มีสื่อที่เผยแพร่</p> : (
            <ol className="space-y-3">
              {d.media.top.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/media/${m.id}`} className="block truncate text-sm font-medium hover:text-brand">{m.title}</Link>
                    <p className="text-xs text-neutral-500">{m.area.name}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs tabular-nums text-neutral-500"><span className="block font-semibold text-neutral-800">{nf.format(m.viewCount)}</span>ครั้ง</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="รออนุมัติ" action={d.media.pending > 0 ? more("/admin/media?status=PENDING") : undefined}>
          {d.media.pendingList.length === 0 ? <p className="text-sm text-neutral-500">ไม่มีสื่อรออนุมัติ</p> : (
            <ul className="space-y-3 text-sm">
              {d.media.pendingList.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/media/${m.id}`} className="block truncate font-medium hover:text-brand">{m.title}</Link>
                  <span className="text-xs text-neutral-500">{m.area.name} · {m.createdBy.name} · ส่งเมื่อ {formatThaiDate(m.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {admin ? (
          <Card title="รหัสสมัครที่ใช้งานอยู่" action={more("/admin/registration-codes", "จัดการรหัส")}>
            <p className="mb-3 text-sm text-neutral-500">ใช้งานได้ {d.codes.valid} จาก {d.codes.total} รหัส · ใช้สมัครไปแล้ว {nf.format(d.codes.uses)} ครั้ง (30 วันล่าสุด {nf.format(d.codes.joined30)} คน) · {d.flags.requireCode ? "ระบบบังคับใช้รหัสสมัคร" : "ระบบเปิดสมัครโดยไม่ต้องใช้รหัส"}</p>
            {d.codes.list.length === 0 ? <p className="text-sm text-neutral-500">ยังไม่มีรหัสที่ใช้งานได้</p> : (
              <ul className="space-y-3 text-sm">
                {d.codes.list.map((c) => (
                  <li key={c.id}>
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/admin/registration-codes/${c.id}`} className="truncate font-medium hover:text-brand">{c.label}</Link>
                      <span className="shrink-0 text-xs tabular-nums text-neutral-500">{c.groupUsed}{c.maxUses !== null ? ` / ${c.maxUses}` : ""}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-brand" style={{ width: c.maxUses ? `${Math.min(100, (c.groupUsed / c.maxUses) * 100)}%` : "100%", opacity: c.maxUses ? 1 : 0.25 }} /></div>
                    <p className="mt-0.5 text-xs text-neutral-500">{MEMBER_TYPE_LABEL[c.memberType]}{c.school ? ` · ${c.school.name}` : ""}{c.expiresAt ? ` · หมดอายุ ${formatThaiDate(c.expiresAt)}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card title="สิทธิ์ของคุณ"><p className="text-sm text-neutral-500">การจัดการสมาชิก รหัสสมัคร และตั้งค่าระบบเป็นของผู้ดูแลระบบ</p></Card>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="ทำเนียบโรงเรียน" action={more("/admin/schools", "จัดการ")}>
          <Bars
            rows={[
              { label: "เข้าใช้บัญชีแล้ว", value: d.schools.activated, color: "#17B26A", suffix: ` / ${d.schools.withAccount}` },
              { label: "มีภาพการ์ด", value: d.schools.total - d.schools.noCard, color: "#0052FF", suffix: ` / ${d.schools.total}` },
              { label: "มีลิงก์เว็บไซต์", value: d.schools.total - d.schools.noLink, color: "#7C3AED", suffix: ` / ${d.schools.total}` },
            ]}
          />
        </Card>
        <Card title="โรงเรียนแยกตามอำเภอ">
          <Bars rows={d.schools.byDistrict.map((x) => ({ label: `อ.${x.district}`, value: x.count }))} empty="ยังไม่มีข้อมูลโรงเรียน" />
        </Card>
        {admin && (
          <Card title="สมาชิกล่าสุด" action={more("/admin/users")}>
            <ul className="space-y-3 text-sm">
              {d.members.recent.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${u.id}`} className="block truncate font-medium hover:text-brand">{u.name}</Link>
                    <p className="truncate text-xs text-neutral-500">{MEMBER_TYPE_LABEL[u.memberType]}{u.memberSchool ? ` · ${u.memberSchool.name}` : ""}{u.registrationCode ? ` · รหัส “${u.registrationCode.label}”` : ""}</p>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-500">{formatThaiDate(u.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
