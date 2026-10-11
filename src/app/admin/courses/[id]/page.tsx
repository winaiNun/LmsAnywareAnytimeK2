import Link from "next/link";
import { notFound } from "next/navigation";
import { canDecideCourse, canReviewCourse } from "@/lib/course/access";
import { COURSE_STATUS_LABEL, getCourseActor } from "@/lib/course/course-server";
import { requireManagerPage } from "@/lib/permissions";
import CourseReviewPanel from "@/app/dashboard/review/courses/course-review-panel";
import CourseReviewView, { loadCourseForReview } from "@/app/dashboard/review/courses/review-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "คอร์ส" };

export default async function AdminCoursePage({ params }: { params: { id: string } }) {
  await requireManagerPage();
  const actor = await getCourseActor();
  const course = await loadCourseForReview(params.id);
  if (!actor || !course) notFound();
  const [label, tone] = COURSE_STATUS_LABEL[course.status];

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/courses" className="text-sm text-brand">← คอร์สเรียน</Link>
      <p className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{label}</span>{course.status === "PUBLISHED" && <Link href={`/courses/${course.id}`} className="text-brand underline">ดูหน้าคอร์ส</Link>}</p>
      <CourseReviewPanel id={course.id} status={course.status} canDecide={canDecideCourse(course.status) && canReviewCourse(actor, course)} isAdmin={actor.role === "ADMIN"} enrollOpen={course.enrollOpen} enrollments={course._count.enrollments} backHref="/admin/courses" />
      <CourseReviewView course={course} />
    </div>
  );
}
