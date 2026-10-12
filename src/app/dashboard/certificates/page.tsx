import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import CertificateView from "@/components/certificate/certificate-view";
import { authOptions } from "@/lib/auth";
import { loadCertificate } from "@/lib/certificate/cert-render-data";
import { ensureAllForUser } from "@/lib/certificate/cert-store";
import { db } from "@/lib/db";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
export const metadata = { title: "เกียรติบัตรของฉัน" };

export default async function MyCertificatesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/dashboard/certificates");
  await ensureAllForUser(session.user.id);
  const [ids, texts] = await Promise.all([
    db.certificate.findMany({ where: { userId: session.user.id }, orderBy: { completedAt: "desc" }, select: { id: true } }),
    getSiteTexts(),
  ]);
  const items = (await Promise.all(ids.map((r) => loadCertificate({ id: r.id })))).filter((c) => c !== null);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <Link href="/dashboard" className="text-sm text-brand">← บัญชีของฉัน</Link>
        <h1 className="text-2xl font-bold">{plainText(texts["certs.title"])}</h1>
        <p className="text-neutral-600">{plainText(texts["certs.subtitle"])}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="font-semibold">ยังไม่มีเกียรติบัตร</p>
          <p className="mt-1 text-sm text-neutral-600">เรียนคอร์สให้จบเพื่อรับเกียรติบัตร (เฉพาะคอร์สที่ผู้สอนตั้งค่าเกียรติบัตรไว้)</p>
          <Link href="/dashboard/learning" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white">คอร์สที่ฉันเรียน</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((c) => (
            <li key={c.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <Link href={`/certificates/${c.id}`} aria-label={`เปิดเกียรติบัตร ${c.courseTitle}`} className="block">
                <CertificateView imageSrc={c.imageSrc} aspect={c.aspect} fields={c.fields} values={c.values} usedFonts={c.usedFonts} watermark={c.status === "PENDING" ? "ตัวอย่าง · รอออกเลข" : undefined} className="pointer-events-none" />
              </Link>
              <div className="space-y-2 p-4">
                <p className="break-words font-semibold">{c.courseTitle}</p>
                <p className="text-xs text-neutral-500">เรียนจบ {formatThaiDate(c.completedAt)}{c.number ? ` · เลขที่ ${c.number}` : ""}</p>
                {c.status === "PENDING" && c.numberMode !== "AUTO" && <p className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{plainText(texts["cert.pending.label"])}</p>}
                {c.status === "PENDING" && c.numberMode === "AUTO" && <Link href={`/certificates/${c.id}`} className="flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">{plainText(texts["cert.auto.button"])}</Link>}
                {c.status === "REVOKED" && <p className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">ถูกเพิกถอน</p>}
                {c.status === "ISSUED" && <Link href={`/certificates/${c.id}`} className="flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">พิมพ์ / บันทึกเป็น PDF</Link>}
                {c.status === "PENDING" && c.numberMode !== "AUTO" && <p className="text-xs text-neutral-500">{plainText(texts["cert.pending.note"])}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
