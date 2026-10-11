import { redirect } from "next/navigation";
import SiteNavbar from "@/components/site-navbar";

export const metadata = { title: "ตรวจสอบเกียรติบัตร", robots: { index: false } };

async function go(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  redirect(code ? `/verify/${code}` : "/verify");
}

export default function VerifyIndexPage() {
  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-xl space-y-4 px-4 pb-28 pt-24 md:pb-16">
        <h1 className="text-2xl font-bold">ตรวจสอบเกียรติบัตร</h1>
        <p className="text-neutral-600">กรอกรหัสตรวจสอบที่พิมพ์อยู่บนเกียรติบัตร (12 ตัวอักษร) เพื่อดูว่าเป็นเกียรติบัตรที่ออกจากระบบจริง</p>
        <form action={go} className="flex flex-col gap-2 sm:flex-row">
          <input name="code" required maxLength={20} autoComplete="off" autoCapitalize="characters" placeholder="เช่น K7M2Q9XA4HTB" aria-label="รหัสตรวจสอบ" className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 font-mono uppercase tracking-wider" />
          <button className="flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">ตรวจสอบ</button>
        </form>
      </main>
    </>
  );
}
