import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/permissions";
import { DeleteButton, FontForm, SerialForm, type SerialRow } from "./certificate-admin-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "เกียรติบัตร" };

export default async function AdminCertificatesPage() {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) redirect("/admin");
  const [serials, fonts] = await Promise.all([
    db.certificateSerial.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { designs: true, certificates: true } } } }),
    db.certificateFont.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, mime: true, size: true } }),
  ]);
  const rows: SerialRow[] = await Promise.all(
    serials.map(async (s) => ({
      id: s.id, name: s.name, pattern: s.pattern, padding: s.padding, nextNo: s.nextNo, resetYearly: s.resetYearly,
      used: await db.certificate.count({ where: { serialId: s.id, number: { not: null } } }), designs: s._count.designs,
    })),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">เกียรติบัตร</h1>
        <p className="text-neutral-600">ชุดเลขที่ใช้ร่วมกันได้หลายคอร์ส และฟอนต์สำหรับตัวออกแบบเกียรติบัตร · การออกแบบและการออกเลขทำที่แท็บ “เกียรติบัตร” ในหน้าแก้ไขแต่ละคอร์ส</p>
      </div>

      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">ชุดเลขเกียรติบัตร</h2>
        <p className="text-sm text-neutral-600">เลขจะออกเรียงต่อกันตามวันที่เรียนจบเมื่อกด “ออกเลข” ในคอร์ส หลายกลุ่มงานใช้ชุดเดียวกันได้เพื่อให้เลขไม่ซ้ำกันทั้งทะเบียน</p>
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.id} className="space-y-3 rounded-xl border border-neutral-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm text-neutral-600">ออกเลขไปแล้ว <strong>{s.used.toLocaleString("th-TH")}</strong> ใบ · ใช้ใน {s.designs} แบบ</p>
                <DeleteButton kind="serial" id={s.id} label={s.name} />
              </div>
              <SerialForm serial={s} />
            </li>
          ))}
        </ul>
        <div className="rounded-xl border border-dashed border-neutral-300 p-4">
          <h3 className="mb-3 font-semibold">สร้างชุดเลขใหม่</h3>
          <SerialForm serial={null} />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">ฟอนต์สำหรับเกียรติบัตร</h2>
        <p className="text-sm text-neutral-600">มีฟอนต์ Sarabun ให้ใช้อยู่แล้ว ต้องการฟอนต์อื่น (เช่น ฟอนต์ราชการ ฟอนต์ลายมือ) เพิ่มไฟล์ที่นี่ได้ แล้วเลือกในตัวออกแบบ</p>
        {fonts.length > 0 && (
          <ul className="space-y-2">
            <style>{fonts.map((f) => `@font-face{font-family:"CertFont-${f.id}";src:url("/api/certificate-fonts/${f.id}");font-display:swap;}`).join("")}</style>
            {fonts.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{f.name} <span className="text-xs font-normal text-neutral-500">{(f.size / 1024).toFixed(0)} KB</span></p>
                  <p className="break-words text-2xl" style={{ fontFamily: `"CertFont-${f.id}", sans-serif` }}>นายวินัย หนุนกระโทก 0123456789</p>
                </div>
                <DeleteButton kind="font" id={f.id} label={f.name} />
              </li>
            ))}
          </ul>
        )}
        <FontForm />
      </section>
    </div>
  );
}
