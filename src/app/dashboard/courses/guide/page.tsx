import Link from "next/link";
import { redirect } from "next/navigation";
import SitePageBody from "@/components/site-page-body";
import { canCreateCourse } from "@/lib/course/access";
import { getCourseActor } from "@/lib/course/course-server";
import { getPage } from "@/lib/site-pages";

export const dynamic = "force-dynamic";
export const metadata = { title: "คู่มือผู้สร้างคอร์ส" };

/** The course-creator guide. The text is an editable site page (admin › หน้าข้อมูลและ Footer), shown only to people who may create courses. */
export default async function CreatorGuidePage() {
  const actor = await getCourseActor();
  if (!actor) redirect("/login?callbackUrl=/dashboard/courses/guide");
  if (!canCreateCourse(actor)) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-28 sm:p-6">
        <Link href="/dashboard" className="text-sm text-brand">← บัญชีของฉัน</Link>
        <h1 className="text-2xl font-bold">คู่มือผู้สร้างคอร์ส</h1>
        <p className="rounded-2xl bg-white p-6 text-neutral-600 shadow-sm">คู่มือนี้สำหรับผู้ที่ได้รับสิทธิ์สร้างคอร์ส — ส่งคำขอได้ที่หน้า “บัญชีของฉัน”</p>
      </main>
    );
  }

  const page = await getPage("creator-guide");
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <Link href="/dashboard/courses" className="text-sm text-brand">← คอร์สของฉัน</Link>
      <h1 className="text-2xl font-bold sm:text-3xl">{page.title}</h1>
      <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
        <SitePageBody body={page.body} allowHtml />
      </div>
    </main>
  );
}
