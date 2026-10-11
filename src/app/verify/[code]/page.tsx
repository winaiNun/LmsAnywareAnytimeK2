import Link from "next/link";
import SiteNavbar from "@/components/site-navbar";
import { db } from "@/lib/db";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตรวจสอบเกียรติบัตร", robots: { index: false, follow: false } };

/** Public check of a certificate by its code. Shows only name, course, number and date; a certificate still waiting for its number reads as "not found". */
export default async function VerifyPage({ params }: { params: { code: string } }) {
  const code = params.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  const c = code.length >= 8
    ? await db.certificate.findUnique({ where: { verifyCode: code }, select: { status: true, number: true, nameSnapshot: true, issuedAt: true, completedAt: true, user: { select: { name: true } }, course: { select: { title: true } } } })
    : null;
  const valid = c?.status === "ISSUED";
  const revoked = c?.status === "REVOKED";

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-xl space-y-4 px-4 pb-28 pt-24 md:pb-16">
        <h1 className="text-2xl font-bold">ตรวจสอบเกียรติบัตร</h1>
        {valid && c ? (
          <section className="space-y-3 rounded-2xl border border-green-200 bg-green-50 p-5">
            <p className="text-lg font-bold text-green-800">✓ เกียรติบัตรนี้ถูกต้อง</p>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-neutral-600">ผู้ได้รับ</dt><dd className="text-lg font-semibold">{c.nameSnapshot ?? c.user.name}</dd></div>
              <div><dt className="text-neutral-600">หลักสูตร</dt><dd className="font-semibold">{c.course.title}</dd></div>
              {c.number && <div><dt className="text-neutral-600">เลขที่เกียรติบัตร</dt><dd className="font-mono font-semibold">{c.number}</dd></div>}
              <div><dt className="text-neutral-600">เรียนจบเมื่อ</dt><dd className="font-semibold">{formatThaiDate(c.completedAt, { style: "long" })}</dd></div>
              {c.issuedAt && <div><dt className="text-neutral-600">ออกเมื่อ</dt><dd className="font-semibold">{formatThaiDate(c.issuedAt, { style: "long" })}</dd></div>}
            </dl>
          </section>
        ) : revoked ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-5 font-semibold text-red-700">เกียรติบัตรนี้ถูกเพิกถอนแล้ว</p>
        ) : (
          <p className="rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-700">ไม่พบเกียรติบัตรตามรหัสนี้ ตรวจสอบรหัสอีกครั้ง</p>
        )}
        <p className="text-sm"><Link href="/verify" className="text-brand underline">ตรวจสอบรหัสอื่น</Link></p>
      </main>
    </>
  );
}
