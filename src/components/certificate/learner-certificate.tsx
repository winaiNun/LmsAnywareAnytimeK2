import Link from "next/link";
import { ensureCertificate } from "@/lib/certificate/cert-store";
import { loadCertificate } from "@/lib/certificate/cert-render-data";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";
import CertificateView from "./certificate-view";

/**
 * The finished-course card: the learner always SEES the certificate (marked as a sample while it has no number), and the
 * print/download button only appears once the number has been issued.
 */
export default async function LearnerCertificate({ userId, courseId }: { userId: string; courseId: string }) {
  const row = await ensureCertificate(userId, courseId);
  if (!row) return null;
  const [c, texts] = await Promise.all([loadCertificate({ id: row.id }), getSiteTexts()]);
  if (!c) return null;

  return (
    <section aria-label="เกียรติบัตร" className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">เกียรติบัตร</h2>
      {c.status === "REVOKED" ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">เกียรติบัตรนี้ถูกเพิกถอน หากมีข้อสงสัยกรุณาติดต่อผู้ดูแลระบบ</p>
      ) : (
        <>
          <CertificateView imageSrc={c.imageSrc} aspect={c.aspect} fields={c.fields} values={c.values} usedFonts={c.usedFonts} watermark={c.status === "PENDING" ? "ตัวอย่าง · รอออกเลข" : undefined} className="rounded-lg shadow ring-1 ring-black/10" />
          {c.status === "PENDING" ? (
            <div className="space-y-2">
              <p className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">{plainText(texts["cert.pending.label"])}</p>
              <p className="text-sm text-neutral-600">{plainText(texts["cert.pending.note"])}</p>
              <button type="button" disabled className="flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-neutral-200 px-6 font-semibold text-neutral-500 sm:w-auto">พิมพ์ / ดาวน์โหลด (ยังไม่เปิดให้ใช้)</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-neutral-600">{plainText(texts["cert.issued.note"])}{c.number ? ` · เลขที่ ${c.number}` : ""}</p>
              <Link href={`/certificates/${c.id}`} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark sm:w-auto">เปิดเพื่อพิมพ์ / บันทึกเป็น PDF</Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
