import { canPreviewCourse } from "@/lib/course/access";
import { accessLesson } from "@/lib/course/course-learn";
import { getCourseActor } from "@/lib/course/course-server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Serves the pasted HTML of a lesson block. Two layers keep it harmless:
 *  - only people who may open that lesson get it (an enrolled learner for an unlocked lesson of a published course,
 *    or the author / a reviewer / an admin previewing); everybody else gets 404, so the HTML is not public;
 *  - the response carries `Content-Security-Policy: sandbox allow-scripts ...`: even when this URL is opened directly
 *    in its own tab the page gets an opaque origin, so its scripts run but can not read our cookies or session.
 */
export async function GET(_req: Request, { params }: { params: { id: string; blockId: string } }) {
  const notFound = () => new Response("Not found", { status: 404 });
  const actor = await getCourseActor();
  if (!actor) return notFound();

  const block = await db.lessonBlock.findUnique({
    where: { id: params.blockId },
    select: { kind: true, html: true, lessonId: true, lesson: { select: { courseId: true, course: { select: { status: true, areaId: true, createdById: true } } } } },
  });
  if (!block || block.kind !== "HTML" || !block.html || block.lesson.courseId !== params.id) return notFound();

  const c = block.lesson.course;
  const mayPreview = canPreviewCourse(actor, { createdById: c.createdById, areaId: c.areaId, status: "PENDING" });
  if (!mayPreview && !(await accessLesson(actor.id, params.id, block.lessonId)).ok) return notFound();

  return new Response(block.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "sandbox allow-scripts allow-popups allow-modals; frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, max-age=120",
    },
  });
}
