import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canDecideCourse, canPreviewCourse, canReviewCourse } from "@/lib/course/access";
import { COURSE_STATUS_LABEL, getCourseActor } from "@/lib/course/course-server";
import CourseReviewPanel from "../course-review-panel";
import CourseReviewView, { loadCourseForReview } from "../review-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตรวจคอร์ส" };

/** Everything in the course, with the answer keys, then the decision. (Nothing here is counted as a learner's activity.) */
export default async function ReviewCoursePage({ params }: { params: { id: string } }) {
  const actor = await getCourseActor();
  if (!actor) redirect(`/login?callbackUrl=/dashboard/review/courses/${params.id}`);
  const course = await loadCourseForReview(params.id);
  if (!course || !canPreviewCourse(actor, { createdById: course.createdById, areaId: course.areaId, status: course.status })) notFound();
  const [label, tone] = COURSE_STATUS_LABEL[course.status];
  const admin = actor.role === "ADMIN";

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <Link href="/dashboard/review/courses" className="text-sm text-brand">← คิวตรวจคอร์ส</Link>
      <p className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{label}</span><span className="text-neutral-500">ตัวอย่างสำหรับผู้ตรวจ — ไม่นับเป็นกิจกรรมของผู้เรียน</span></p>
      <CourseReviewPanel id={course.id} status={course.status} canDecide={canDecideCourse(course.status) && canReviewCourse(actor, course)} isAdmin={admin} enrollOpen={course.enrollOpen} enrollments={course._count.enrollments} backHref="/dashboard/review/courses" />
      <CourseReviewView course={course} />
    </main>
  );
}
