/**
 * Who may do what with a course. Pure functions (the server actions load the facts, these decide), so the whole
 * permission table can be unit-tested. Same shape as media-access.ts: reviewers are ordinary members appointed per
 * learning area, and nobody reviews their own course.
 */
export type CourseStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED";

export type CourseActor = {
  id: string;
  role: string; // ADMIN | LIBRARIAN | TEACHER | STUDENT (permission role)
  creatorStatus?: string; // NONE | PENDING | APPROVED | REJECTED
  selfPublish?: boolean; // an admin trusts this creator: courses are published without the review queue
  memberType?: string; // STUDENT | TEACHER | SCHOOL_ADMIN | SUPERVISOR | DISTRICT_STAFF | GENERAL (for course audiences)
  reviewerAreaIds: string[];
};
export type CourseFacts = { createdById: string; areaId: string; status?: CourseStatus; enrollOpen?: boolean; audienceTypes?: string[]; audienceOnly?: boolean };

export const DAILY_COURSE_LIMIT = 10; // new courses per person per day
export const MAX_LESSONS = 200;
export const MAX_BLOCKS_PER_LESSON = 20;
export const MAX_QUESTIONS_PER_QUIZ = 100;

export const isCourseAdmin = (a: Pick<CourseActor, "role">) => a.role === "ADMIN";
export const isCourseReviewer = (a: CourseActor) => a.reviewerAreaIds.length > 0;

/** Create: admins, and members an admin approved as creators (their permission role becomes TEACHER at approval). */
export const canCreateCourse = (a: Pick<CourseActor, "role" | "creatorStatus">) =>
  a.role === "ADMIN" || a.role === "TEACHER" || a.creatorStatus === "APPROVED";

/** Edit / delete: the author, or an admin. */
export const canEditCourse = (a: CourseActor, c: Pick<CourseFacts, "createdById">) => isCourseAdmin(a) || a.id === c.createdById;

/** Approve / send back: an admin, or the reviewer of this area (never for their own course). */
export const canReviewCourse = (a: CourseActor, c: Pick<CourseFacts, "createdById" | "areaId">) =>
  isCourseAdmin(a) || (a.reviewerAreaIds.includes(c.areaId) && a.id !== c.createdById);

/** Look at a course that is not public: the author, an admin, or any reviewer of the area (even their own course). */
export const canPreviewCourse = (a: CourseActor | null, c: CourseFacts) =>
  c.status === "PUBLISHED" || (!!a && (canEditCourse(a, c) || isCourseAdmin(a) || a.reviewerAreaIds.includes(c.areaId)));

/** Unpublish / delete / switch enrolment off for others' courses: admins only. */
export const canManageCourse = (a: Pick<CourseActor, "role">) => isCourseAdmin(a);

/** Review decisions only apply to courses waiting in the queue. */
export const canDecideCourse = (status: CourseStatus) => status === "PENDING";

/** What a save does to the status. `submit` = the "send for review" (or, for admins, "publish") button. */
export function courseStatusAfterSave(a: Pick<CourseActor, "role" | "selfPublish">, current: CourseStatus | null, submit: boolean): CourseStatus {
  if (isCourseAdmin(a) || a.selfPublish) return submit || current === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  if (submit) return "PENDING";
  // changing something that is live puts it back in the queue; the rest stays a draft
  return current === "PUBLISHED" || current === "PENDING" ? "PENDING" : "DRAFT";
}

/** The course is meant for certain member types (recommended) or restricted to them. */
export const isForAudience = (c: Pick<CourseFacts, "audienceTypes">, memberType?: string | null) => !!memberType && (c.audienceTypes ?? []).includes(memberType);

/**
 * Anyone signed in may enrol in a public course that is open for sign-ups. A course marked "only for ..." (audienceOnly) is
 * closed to other member types; its author and admins are never blocked, so they can still open and check it.
 */
export const canEnroll = (c: Pick<CourseFacts, "status" | "enrollOpen" | "audienceTypes" | "audienceOnly">, who?: { role?: string; memberType?: string | null } | null) => {
  if (c.status !== "PUBLISHED" || c.enrollOpen === false) return false;
  if (c.audienceOnly && (c.audienceTypes ?? []).length > 0 && who?.role !== "ADMIN") return isForAudience(c, who?.memberType);
  return true;
};

/** Learners see lessons of a published course they are enrolled in; the author/admin/reviewer may preview anything. */
export function canLearn(a: CourseActor | null, c: CourseFacts, enrolled: boolean): { ok: true; preview: boolean } | { ok: false; reason: "login" | "enroll" | "unavailable" } {
  if (!a) return { ok: false, reason: "login" };
  if (c.status !== "PUBLISHED") return canPreviewCourse(a, c) ? { ok: true, preview: true } : { ok: false, reason: "unavailable" };
  if (enrolled) return { ok: true, preview: false };
  // authors and admins may open their own live course without enrolling (nothing is recorded for them)
  if (canEditCourse(a, c)) return { ok: true, preview: true };
  return { ok: false, reason: "enroll" };
}

/** Problems that stop a course from being sent for review (Thai messages, empty = fine). */
export function courseReadiness(c: {
  title: string;
  description: string;
  hasCover: boolean;
  lessons: { title: string; blockCount: number }[];
  quizzes: { title: string; questionCount: number; invalidQuestions: number }[];
}): string[] {
  const out: string[] = [];
  if (c.title.trim().length < 3) out.push("ชื่อคอร์สต้องมีอย่างน้อย 3 ตัวอักษร");
  if (c.description.trim().length < 10) out.push("กรุณาเขียนคำอธิบายคอร์สอย่างน้อย 10 ตัวอักษร");
  if (!c.hasCover) out.push("กรุณาใส่ภาพปกคอร์ส");
  if (c.lessons.length === 0) out.push("ต้องมีบทเรียนอย่างน้อย 1 บท");
  for (const l of c.lessons) if (l.blockCount === 0) out.push(`บท “${l.title}” ยังไม่มีเนื้อหา`);
  for (const q of c.quizzes) {
    if (q.questionCount === 0) out.push(`แบบทดสอบ “${q.title}” ยังไม่มีคำถาม`);
    if (q.invalidQuestions > 0) out.push(`แบบทดสอบ “${q.title}” มีคำถามที่ตั้งเฉลยไม่ครบ ${q.invalidQuestions} ข้อ`);
  }
  return out;
}
