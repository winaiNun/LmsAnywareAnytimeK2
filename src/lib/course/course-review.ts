/**
 * Review, publishing and enrolment of courses. Like course-save.ts it takes the actor as a parameter and never calls
 * Next-only cache APIs, so it can be tested against the real database.
 */
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { rateLimited } from "@/lib/rate-limit";
import { canDecideCourse, canEditCourse, canEnroll, canManageCourse, canReviewCourse, type CourseActor } from "./access";

type Res<T extends object = object> = ({ ok: true } & T) | { error: string };

/** A reviewer (or admin) approves or sends back a course that waits in the queue. */
export async function reviewCourseAs(actor: CourseActor, courseId: string, decision: "approve" | "reject", note: string): Promise<Res> {
  const c = await db.course.findUnique({ where: { id: courseId }, select: { id: true, status: true, areaId: true, createdById: true, title: true, publishedAt: true } });
  if (!c) return { error: "ไม่พบคอร์สนี้" };
  if (!canDecideCourse(c.status)) return { error: "คอร์สนี้ไม่ได้อยู่ในสถานะรออนุมัติ" };
  if (!canReviewCourse(actor, c)) return { error: c.createdById === actor.id ? "อนุมัติคอร์สของตัวเองไม่ได้ ให้ผู้ตรวจคนอื่นหรือผู้ดูแลระบบอนุมัติ" : "ไม่มีสิทธิ์ตรวจคอร์สนี้" };
  const text = note.trim().slice(0, 500);
  if (decision === "reject" && text.length < 5) return { error: "กรุณาระบุเหตุผลที่ส่งกลับอย่างน้อย 5 ตัวอักษร เพื่อให้ผู้สร้างแก้ไขได้ถูกจุด" };
  const now = new Date();
  await db.course.update({
    where: { id: courseId },
    data: decision === "approve"
      ? { status: "PUBLISHED", publishedAt: c.publishedAt ?? now, reviewedById: actor.id, reviewedAt: now, reviewNote: text || null }
      : { status: "REJECTED", reviewedById: actor.id, reviewedAt: now, reviewNote: text },
  });
  await audit({ actorId: actor.id, action: decision === "approve" ? "course.approve" : "course.reject", entity: "Course", entityId: courseId, meta: { title: c.title } });
  return { ok: true };
}

/** Admin only: take a published course back to a draft (learners keep their progress; they can not open it until it is published again). */
export async function unpublishCourseAs(actor: CourseActor, courseId: string): Promise<Res> {
  if (!canManageCourse(actor)) return { error: "ไม่มีสิทธิ์" };
  const r = await db.course.updateMany({ where: { id: courseId, status: { in: ["PUBLISHED", "PENDING"] } }, data: { status: "DRAFT" } });
  if (!r.count) return { error: "คอร์สนี้ไม่ได้เผยแพร่อยู่" };
  await audit({ actorId: actor.id, action: "course.unpublish", entity: "Course", entityId: courseId });
  return { ok: true };
}

/** Open / close sign-ups without sending the course back to review (author or admin). */
export async function setEnrollOpenAs(actor: CourseActor, courseId: string, open: boolean): Promise<Res> {
  const c = await db.course.findUnique({ where: { id: courseId }, select: { createdById: true, areaId: true } });
  if (!c) return { error: "ไม่พบคอร์สนี้" };
  if (!canEditCourse(actor, c)) return { error: "ไม่มีสิทธิ์" };
  await db.course.update({ where: { id: courseId }, data: { enrollOpen: open } });
  await audit({ actorId: actor.id, action: open ? "course.enroll-open" : "course.enroll-close", entity: "Course", entityId: courseId });
  return { ok: true };
}

/** A signed-in member joins a public course that is open for sign-ups. Joining twice is harmless. */
export async function enrollAs(userId: string, courseId: string): Promise<Res<{ already: boolean }>> {
  if (rateLimited(`enroll:${userId}`, 30, 60 * 60 * 1000)) return { error: "ลงทะเบียนบ่อยเกินไป กรุณารอสักครู่" };
  const c = await db.course.findUnique({ where: { id: courseId }, select: { status: true, enrollOpen: true } });
  if (!c || c.status !== "PUBLISHED") return { error: "ไม่พบคอร์สนี้" };
  const existing = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { id: true } });
  if (existing) return { ok: true, already: true };
  if (!canEnroll(c)) return { error: "คอร์สนี้ปิดรับลงทะเบียนแล้ว" };
  try {
    await db.enrollment.create({ data: { userId, courseId } });
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") return { ok: true, already: true }; // two clicks at once
    throw e;
  }
  await audit({ actorId: userId, action: "course.enroll", entity: "Course", entityId: courseId });
  return { ok: true, already: false };
}
