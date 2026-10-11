import Link from "next/link";
import { redirect } from "next/navigation";
import { canCreateCourse } from "@/lib/course/access";
import { getCourseActor } from "@/lib/course/course-server";
import { getFormOptions } from "@/lib/media-data";
import { storageIsDurable } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";
import CourseInfoForm from "../course-info-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "สร้างคอร์ส" };

export default async function NewCoursePage() {
  const actor = await getCourseActor();
  if (!actor) redirect("/login?callbackUrl=/dashboard/courses/new");
  if (!canCreateCourse(actor)) redirect("/dashboard/courses");
  const [{ areas, levels }, site] = await Promise.all([getFormOptions(), getSiteInfo()]);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <Link href="/dashboard/courses" className="text-sm text-brand">← คอร์สของฉัน</Link>
        <h1 className="text-2xl font-bold">สร้างคอร์ส</h1>
        <p className="text-sm text-neutral-500">กรอกข้อมูลพื้นฐานก่อน แล้วไปเพิ่มบทเรียนและแบบทดสอบในขั้นถัดไป</p>
      </div>
      <CourseInfoForm
        values={{ title: "", description: "", areaId: "", levelIds: [], instructorName: "", hours: "", enrollOpen: true, coverUrl: null, coverDrive: "", coverFx: 0.5, coverFy: 0.5 }}
        areas={areas}
        levels={levels}
        allowUpload={site.allowServerUploads && storageIsDurable()}
      />
    </main>
  );
}
