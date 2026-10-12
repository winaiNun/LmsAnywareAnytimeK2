import Link from "next/link";
import CertificateView from "@/components/certificate/certificate-view";
import { backfillCertificatesPreview } from "@/lib/certificate/cert-read";
import { parseFields, type CertValues } from "@/lib/certificate/schema";
import { db } from "@/lib/db";
import { driveThumbnailUrl } from "@/lib/drive";
import { NUMBER_MODE_LABEL } from "@/lib/certificate/schema";
import { formatThaiDate } from "@/lib/thai-date";
import CertificateDesigner from "./certificate-designer";
import { IssuePanel, NewDesignForm, RowActions } from "./certificate-manage";

const A4 = 297 / 210;
const STATUS: Record<string, [string, string]> = {
  PENDING: ["รอออกเลข", "bg-amber-50 text-amber-800"],
  ISSUED: ["ออกแล้ว", "bg-green-50 text-green-700"],
  REVOKED: ["เพิกถอน", "bg-red-50 text-red-700"],
};

export default async function CertificateTab({ courseId, isAdmin, designId, status }: { courseId: string; isAdmin: boolean; designId?: string; status?: string }) {
  const base = `/dashboard/courses/${courseId}/edit?tab=certificate`;
  const [course, designs, serials, fonts] = await Promise.all([
    db.course.findUniqueOrThrow({ where: { id: courseId }, select: { title: true, hours: true, instructorName: true } }),
    db.certificateDesign.findMany({ where: { courseId }, orderBy: { position: "asc" }, include: { serial: { select: { name: true, mode: true } }, _count: { select: { certificates: true } } } }),
    db.certificateSerial.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, pattern: true } }),
    db.certificateFont.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const srcOf = (d: { imageDriveId: string | null }) => (d.imageDriveId ? driveThumbnailUrl(d.imageDriveId, 2400) : null);
  const aspectOf = (d: { imageW: number; imageH: number }) => (d.imageW > 0 && d.imageH > 0 ? d.imageW / d.imageH : A4);
  const hours = course.hours === null ? "" : String(course.hours);

  const design = designId ? designs.find((d) => d.id === designId) : null;
  if (design) {
    const courseSample: Partial<CertValues> = { course: course.title, hours, instructor: course.instructorName ?? "" };
    return (
      <div className="space-y-3">
        <Link href={base} className="text-sm text-brand">← แบบเกียรติบัตรทั้งหมด</Link>
        <CertificateDesigner
          courseId={courseId}
          design={{ id: design.id, name: design.name, isDefault: design.isDefault, minScore: design.minScore, serialId: design.serialId, imageSrc: srcOf(design), aspect: aspectOf(design), fields: parseFields(design.fields), hasCertificates: design._count.certificates > 0 }}
          serials={serials}
          isAdmin={isAdmin}
          customFonts={fonts}
          courseSample={courseSample}
        />
      </div>
    );
  }

  const filter = ["PENDING", "ISSUED", "REVOKED"].includes(status ?? "") ? (status as "PENDING" | "ISSUED" | "REVOKED") : undefined;
  const [counts, rows, finishedWithoutRow] = await Promise.all([
    db.certificate.groupBy({ by: ["status"], where: { courseId }, _count: true }),
    db.certificate.findMany({ where: { courseId, ...(filter && { status: filter }) }, orderBy: [{ completedAt: "desc" }], take: 100, include: { user: { select: { name: true } }, design: { select: { name: true, serial: { select: { mode: true } } } } } }),
    backfillCertificatesPreview(courseId),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const waiting = n("PENDING");
  const waitingAll = waiting + finishedWithoutRow;

  return (
    <section className="space-y-5">
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">แบบเกียรติบัตรของคอร์สนี้</h2>
        <p className="text-sm text-neutral-600">หนึ่งคอร์สมีได้หลายแบบ เช่น “ผ่านการอบรม” กับ “คะแนนสูง” ผู้เรียนจะได้แบบตามเงื่อนไขคะแนนที่ตั้งไว้ และเห็นเกียรติบัตรทันทีที่เรียนจบ แต่ดาวน์โหลดได้หลังออกเลขแล้ว</p>
        {designs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-600">ยังไม่มีแบบเกียรติบัตร — ผู้เรียนที่จบคอร์สนี้จะยังไม่เห็นเกียรติบัตร</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {designs.map((d) => (
              <li key={d.id} className="overflow-hidden rounded-xl border border-neutral-200">
                <Link href={`${base}&design=${d.id}`} className="block" aria-label={`แก้ไขแบบ ${d.name}`}>
                  <CertificateView
                    imageSrc={srcOf(d)}
                    aspect={aspectOf(d)}
                    fields={parseFields(d.fields)}
                    values={{ name: "นายสมชาย ใจดี", number: "0001/2569", date: "11 ตุลาคม 2569", course: course.title, score: "92", hours, instructor: course.instructorName ?? "" }}
                    className="pointer-events-none"
                  />
                </Link>
                <div className="space-y-1 p-3">
                  <p className="font-semibold">{d.name}</p>
                  <p className="flex flex-wrap gap-1.5 text-xs">
                    {d.isDefault && <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">แบบเริ่มต้น</span>}
                    {d.minScore !== null && <span className="rounded-full bg-neutral-100 px-2 py-0.5">คะแนน ≥ {d.minScore}%</span>}
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5">{d.serial ? `ชุดเลข: ${d.serial.name} (${NUMBER_MODE_LABEL[d.serial.mode].title})` : "ไม่ใช้เลข"}</span>
                    {!d.imageDriveId && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">ยังไม่มีภาพเทมเพลต</span>}
                  </p>
                  <Link href={`${base}&design=${d.id}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand">ออกแบบ/แก้ไข →</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <NewDesignForm courseId={courseId} />
      </div>

      {designs.length > 0 && (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">ผู้เรียนที่ได้รับเกียรติบัตร</h2>
          <div className="grid grid-cols-3 gap-3">
            {([["รอออกเลข / รอกดรับ", waitingAll], ["ออกแล้ว", n("ISSUED")], ["เพิกถอน", n("REVOKED")]] as const).map(([l, v]) => (
              <div key={l} className="rounded-lg bg-neutral-50 p-3"><p className="text-2xl font-bold tabular-nums">{v.toLocaleString("th-TH")}</p><p className="text-sm text-neutral-600">{l}</p></div>
            ))}
          </div>
          {isAdmin ? (
            <IssuePanel courseId={courseId} waiting={waiting} finishedWithoutRow={finishedWithoutRow} />
          ) : (
            waitingAll > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">มีผู้เรียนรอออกเลข {waitingAll.toLocaleString("th-TH")} คน — ผู้ดูแลระบบของเขตพื้นที่เป็นผู้ออกเลข</p>
          )}

          <nav aria-label="กรองตามสถานะ" className="flex flex-wrap gap-2">
            {([[undefined, "ทั้งหมด"], ["PENDING", "รอออกเลข"], ["ISSUED", "ออกแล้ว"], ["REVOKED", "เพิกถอน"]] as const).map(([k, l]) => (
              <Link key={l} href={k ? `${base}&status=${k}` : base} aria-current={filter === k ? "page" : undefined} className={`flex min-h-10 items-center rounded-full border px-4 text-sm ${filter === k ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>{l}</Link>
            ))}
          </nav>
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-500">ยังไม่มีรายการ</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {rows.map((r) => {
                const [label0, tone] = STATUS[r.status];
                const label = r.status === "PENDING" && r.design.serial?.mode === "AUTO" ? "รอผู้เรียนกดรับ" : label0;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{r.nameSnapshot ?? r.user.name}</p>
                      <p className="text-xs text-neutral-500">
                        {r.number ? `เลขที่ ${r.number} · ` : ""}จบ {formatThaiDate(r.completedAt)} · แบบ {r.design.name}
                        {r.scorePercent !== null ? ` · คะแนน ${r.scorePercent}%` : ""}
                        {r.revokeNote ? ` · เหตุผล: ${r.revokeNote}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>
                      {isAdmin && <RowActions courseId={courseId} id={r.id} status={r.status} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
