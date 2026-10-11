import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import CertificateView from "@/components/certificate/certificate-view";
import { PRINT_CSS } from "@/components/certificate/print-css";
import PrintButton from "@/components/certificate/print-button";
import SiteNavbar from "@/components/site-navbar";
import { authOptions } from "@/lib/auth";
import { loadCertificate } from "@/lib/certificate/cert-render-data";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "เกียรติบัตร", robots: { index: false } };

export default async function CertificatePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=/certificates/${params.id}`);
  const c = await loadCertificate({ id: params.id });
  // only the holder, the course author and admins may open it; anyone else gets the same "not found" as a wrong link
  if (!c || !(session.user.id === c.userId || session.user.id === c.courseAuthorId || session.user.role === "ADMIN")) notFound();
  const texts = await getSiteTexts();
  const holder = session.user.id === c.userId;

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-5xl space-y-4 px-4 pb-28 pt-24 md:pb-16">
        <style>{PRINT_CSS}</style>
        <div className="no-print space-y-1">
          <Link href={holder ? "/dashboard/certificates" : `/dashboard/courses/${c.courseId}/edit?tab=certificate`} className="text-sm text-brand">← {holder ? "เกียรติบัตรของฉัน" : "กลับไปหน้าจัดการ"}</Link>
          <h1 className="text-2xl font-bold">เกียรติบัตร</h1>
          <p className="text-neutral-600">{c.courseTitle}{c.number ? ` · เลขที่ ${c.number}` : ""}{!holder ? ` · ${c.holderName}` : ""}</p>
        </div>

        {c.status === "REVOKED" ? (
          <p className="rounded-xl bg-red-50 p-4 text-red-700">เกียรติบัตรนี้ถูกเพิกถอน</p>
        ) : (
          <>
            <CertificateView imageSrc={c.imageSrc} aspect={c.aspect} fields={c.fields} values={c.values} usedFonts={c.usedFonts} watermark={c.status === "PENDING" ? "ตัวอย่าง · รอออกเลข" : undefined} className="rounded-lg shadow-lg ring-1 ring-black/10" />
            <div className="no-print space-y-3">
              {c.status === "PENDING" ? (
                <>
                  <p className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">{plainText(texts["cert.pending.label"])}</p>
                  <p className="text-neutral-600">{plainText(texts["cert.pending.note"])}</p>
                </>
              ) : (
                <>
                  <PrintButton />
                  <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600">
                    <li>ในหน้าต่างพิมพ์ เลือกปลายทางเป็น “บันทึกเป็น PDF” หรือเครื่องพิมพ์ของคุณ</li>
                    <li>เลือกกระดาษ A4 แนวนอน ระยะขอบ “ไม่มี” และเปิด “กราฟิกพื้นหลัง” ถ้ามีตัวเลือก</li>
                    <li>ตรวจสอบความถูกต้องของเกียรติบัตรได้ที่ <Link href={`/verify/${c.verifyCode}`} className="text-brand underline">หน้าตรวจสอบ</Link> รหัส <span className="font-mono">{c.verifyCode}</span></li>
                  </ul>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
