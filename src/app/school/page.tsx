import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import SchoolCard from "@/components/school-card";
import SiteNavbar from "@/components/site-navbar";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { storageIsDurable, toListItem } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";
import { formatThaiDate } from "@/lib/thai-date";
import SchoolPortalForm from "./portal-form";

export const dynamic = "force-dynamic";

export default async function SchoolPortalPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/school");

  const [school, site] = await Promise.all([db.school.findUnique({ where: { accountId: session.user.id } }), getSiteInfo()]);

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-4xl space-y-6 px-4 pb-28 pt-24 md:pb-16">
        {!school ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <h1 className="text-xl font-bold">บัญชีนี้ไม่ได้เชื่อมกับโรงเรียนใด</h1>
            <Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white">ไปที่บัญชีของฉัน</Link>
          </div>
        ) : (
          <>
            <header className="space-y-1">
              <p className="text-sm text-neutral-500">โรงเรียนของฉัน</p>
              <h1 className="text-2xl font-bold sm:text-3xl">{school.name}</h1>
              <p className="text-neutral-600">รหัส {school.code} · อ.{school.district} · {school.center}{school.updatedAt ? ` · แก้ล่าสุด ${formatThaiDate(school.updatedAt, { time: true })}` : ""}</p>
              {!school.active && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">โรงเรียนของคุณถูกปิดการแสดงผลชั่วคราว ติดต่อผู้ดูแลระบบหากต้องการเปิดอีกครั้ง</p>}
            </header>

            <div className="grid gap-6 md:grid-cols-5">
              <section className="space-y-3 md:col-span-2" aria-label="ตัวอย่างที่แสดงบนเว็บ">
                <h2 className="font-semibold">การ์ดที่แสดงบนหน้าเว็บ</h2>
                <SchoolCard school={toListItem(school)} />
                <Link href={`/schools?q=${school.code}`} className="text-sm text-brand">ดูในหน้าทำเนียบโรงเรียน →</Link>
              </section>
              <section className="md:col-span-3">
                <SchoolPortalForm siteUrl={school.siteUrl ?? ""} cardSourceUrl={school.cardSourceUrl ?? ""} cardUrl={toListItem(school).cardUrl} allowUpload={storageIsDurable() && site.allowServerUploads} cardError={school.cardStatus === "failed" ? school.cardError : null} />
              </section>
            </div>

            <p className="text-sm text-neutral-500">ชื่อโรงเรียน อำเภอ และศูนย์เครือข่าย แก้ไขได้โดยผู้ดูแลระบบเท่านั้น · <Link href="/account/password" className="text-brand">เปลี่ยนรหัสผ่าน</Link></p>
          </>
        )}
      </main>
    </>
  );
}
