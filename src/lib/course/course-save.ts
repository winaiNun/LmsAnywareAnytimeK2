/**
 * Everything a course author does: course info, lessons, content blocks, quizzes and questions, plus sending for review.
 * Each function takes the actor (and never calls Next-only cache APIs) so it can be tested against the real database;
 * the server actions in src/app/dashboard/courses/actions.ts add the sign-in check and the cache refresh.
 * Every change by a non-admin to a course that is live or waiting sends it (back) to the review queue.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { driveThumbnailUrl, parseDriveFileId } from "@/lib/drive";
import { safeHttpsUrl } from "@/lib/embed";
import { processCover } from "@/lib/image";
import { rateLimited } from "@/lib/rate-limit";
import { storageIsDurable } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";
import { getStorage } from "@/lib/storage";
import { DAILY_COURSE_LIMIT, MAX_BLOCKS_PER_LESSON, MAX_LESSONS, MAX_QUESTIONS_PER_QUIZ, canCreateCourse, canEditCourse, courseReadiness, courseStatusAfterSave, type CourseActor, type CourseStatus } from "./access";
import { MAX_HTML_BLOCKS_PER_LESSON, cleanBlock, type BlockInput } from "./blocks";
import { parseQuestion, QUESTION_TYPES } from "./quiz/schemas";

export type Res<T extends object = object> = ({ ok: true } & T) | { error: string };
const NO_RIGHT = { error: "ไม่มีสิทธิ์แก้ไขคอร์สนี้" } as const;
const NOT_FOUND = { error: "ไม่พบรายการนี้" } as const;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const safeDelete = (keys: (string | null | undefined)[]) => Promise.all(keys.filter((k): k is string => !!k).map((k) => getStorage().delete(k).catch(() => {})));

/** Edits are limited so that a script can not hammer the database (per author, per hour). */
const tooMany = (actor: CourseActor) => rateLimited(`course-edit:${actor.id}`, 600, 60 * 60 * 1000);

type Failure = { error: string };
type OwnedCourse = { id: string; status: CourseStatus; createdById: string; areaId: string; coverKey: string | null };

async function loadOwned(actor: CourseActor, courseId: string): Promise<Failure | { course: OwnedCourse }> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, status: true, createdById: true, areaId: true, coverKey: true } });
  if (!course) return { error: NOT_FOUND.error };
  if (!canEditCourse(actor, course)) return { error: NO_RIGHT.error };
  return { course };
}

/** After any change: a live/pending course edited by a non-admin goes (back) to the queue; a rejected one becomes a draft again. */
async function touch(actor: CourseActor, courseId: string, current: CourseStatus) {
  const next = courseStatusAfterSave(actor, current, false);
  await db.course.update({ where: { id: courseId }, data: { updatedAt: new Date(), ...(next !== current ? { status: next } : {}), ...(next === "PENDING" ? { reviewNote: null } : {}) } });
}

// ------------------------------------------------------------------------------------------------ course info
const infoSchema = z.object({
  title: z.string().trim().min(3, "ชื่อคอร์สต้องมีอย่างน้อย 3 ตัวอักษร").max(120),
  description: z.string().trim().max(3000).default(""),
  areaId: z.string().min(1, "กรุณาเลือกกลุ่มสาระ"),
  levelIds: z.array(z.string()).max(10).default([]),
  instructorName: z.string().trim().max(100).default(""),
  hours: z.number().min(0.1, "จำนวนชั่วโมงต้องมากกว่า 0").max(1000).nullable().default(null),
  enrollOpen: z.boolean().default(true),
  cover: z.object({ mode: z.enum(["keep", "none", "drive", "upload"]), link: z.string().max(500).optional(), fx: z.number().min(0).max(1).default(0.5), fy: z.number().min(0).max(1).default(0.5) }).default({ mode: "keep", fx: 0.5, fy: 0.5 }),
});

/** Create (courseId = null) or edit the basic information and cover of a course. `payload` is JSON; the cropped cover travels as `cover`. */
export async function saveCourseInfoAs(actor: CourseActor, courseId: string | null, formData: FormData): Promise<Res<{ id: string; status: CourseStatus }>> {
  let raw: unknown;
  try { raw = JSON.parse(String(formData.get("payload") ?? "")); } catch { return { error: "ข้อมูลไม่ถูกต้อง" }; }
  const parsed = infoSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const d = parsed.data;

  const existing = courseId ? await db.course.findUnique({ where: { id: courseId } }) : null;
  if (courseId && !existing) return { error: NOT_FOUND.error };
  if (existing && !canEditCourse(actor, existing)) return { error: NO_RIGHT.error };
  if (!existing) {
    if (!canCreateCourse(actor)) return { error: "ยังไม่มีสิทธิ์สร้างคอร์ส — ขอเป็นผู้สร้างได้ที่หน้าบัญชีของฉัน" };
    if (rateLimited(`course-new:${actor.id}`, 20, 60 * 60 * 1000)) return { error: "สร้างคอร์สบ่อยเกินไป กรุณารอสักครู่" };
    const today = await db.course.count({ where: { createdById: actor.id, createdAt: { gte: new Date(Date.now() - 86400000) } } });
    if (today >= DAILY_COURSE_LIMIT && actor.role !== "ADMIN") return { error: `สร้างคอร์สได้ไม่เกิน ${DAILY_COURSE_LIMIT} คอร์สต่อวัน` };
  } else if (tooMany(actor)) return { error: "แก้ไขบ่อยเกินไป กรุณารอสักครู่" };

  const [area, levels, site] = await Promise.all([
    db.learningArea.findFirst({ where: { id: d.areaId, active: true }, select: { id: true } }),
    d.levelIds.length ? db.educationLevel.findMany({ where: { id: { in: d.levelIds }, active: true }, select: { id: true } }) : [],
    getSiteInfo(),
  ]);
  if (!area) return { error: "ไม่พบกลุ่มสาระที่เลือก" };
  const uploadsAllowed = site.allowServerUploads && storageIsDurable();

  let coverKey = existing?.coverKey ?? null;
  let coverDriveId = existing?.coverDriveId ?? null;
  let coverFx = existing?.coverFx ?? 0.5;
  let coverFy = existing?.coverFy ?? 0.5;
  const stale: (string | null)[] = [];
  let newCover: Buffer | null = null;
  if (d.cover.mode === "none") { stale.push(coverKey); coverKey = null; coverDriveId = null; }
  else if (d.cover.mode === "drive") {
    const id = parseDriveFileId(d.cover.link);
    if (!id) return { error: "ลิงก์ภาพปกต้องเป็นลิงก์ไฟล์จาก drive.google.com" };
    stale.push(coverKey); coverKey = null; coverDriveId = id; coverFx = d.cover.fx; coverFy = d.cover.fy;
  } else if (d.cover.mode === "upload") {
    if (!uploadsAllowed) return { error: "ขณะนี้ปิดการอัปโหลดรูปเข้าเซิร์ฟเวอร์ — ใช้ลิงก์ Google Drive แทน" };
    const file = formData.get("cover");
    if (!(file instanceof File) || file.size === 0) return { error: "ยังไม่ได้เลือกภาพปก" };
    if (file.size > MAX_UPLOAD_BYTES) return { error: "ภาพปกต้องไม่เกิน 4 MB" };
    try { newCover = await processCover(Buffer.from(await file.arrayBuffer()), { aspect: 16 / 9, maxWidth: 960 }); } catch { return { error: "ไฟล์ภาพปกอ่านไม่ได้" }; }
    stale.push(coverKey); coverDriveId = null;
  }

  const written: string[] = [];
  if (newCover) {
    try { coverKey = `media/course-${randomUUID()}.webp`; await getStorage().put(coverKey, newCover, "image/webp"); written.push(coverKey); }
    catch (e) { console.error("course cover upload failed", e); return { error: "อัปโหลดภาพปกไม่สำเร็จ ลองใหม่อีกครั้ง" }; }
  }

  const status = existing ? courseStatusAfterSave(actor, existing.status, false) : "DRAFT";
  const data = {
    title: d.title, description: d.description, areaId: d.areaId, instructorName: d.instructorName || null, hours: d.hours, enrollOpen: d.enrollOpen,
    coverKey, coverDriveId, coverFx, coverFy, status,
    ...(status === "PENDING" ? { reviewNote: null } : {}),
  };
  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const c = existing ? await tx.course.update({ where: { id: existing.id }, data, select: { id: true } }) : await tx.course.create({ data: { ...data, createdById: actor.id }, select: { id: true } });
      await tx.courseLevel.deleteMany({ where: { courseId: c.id } });
      if (levels.length) await tx.courseLevel.createMany({ data: levels.map((l) => ({ courseId: c.id, levelId: l.id })) });
      return c.id;
    });
  } catch (e) {
    console.error("course save failed", e);
    await safeDelete(written);
    return { error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  await safeDelete(stale.filter((k) => k && !written.includes(k)));
  await audit({ actorId: actor.id, action: existing ? "course.update" : "course.create", entity: "Course", entityId: id, meta: { status, title: d.title } });
  return { ok: true, id, status };
}

/** Cover as shown on cards and pages (our stored copy, or the public Drive file's thumbnail). */
export const courseCoverSrc = (c: { coverKey: string | null; coverDriveId: string | null }, fileUrl: (key: string | null) => string | null, px = 640): string | null =>
  c.coverKey ? fileUrl(c.coverKey) : c.coverDriveId ? driveThumbnailUrl(c.coverDriveId, px) : null;

// ------------------------------------------------------------------------------------------------ sending for review
/** The checks that stop a course from being sent (Thai messages). Also used by the "ready?" tab of the editor. */
export async function readinessOf(courseId: string): Promise<string[]> {
  const c = await db.course.findUnique({
    where: { id: courseId },
    include: { lessons: { include: { _count: { select: { blocks: true } } }, orderBy: { position: "asc" } }, quizzes: { include: { questions: true } } },
  });
  if (!c) return ["ไม่พบคอร์ส"];
  return courseReadiness({
    title: c.title,
    description: c.description,
    hasCover: !!(c.coverKey || c.coverDriveId),
    lessons: c.lessons.map((l) => ({ title: l.title, blockCount: l._count.blocks })),
    quizzes: c.quizzes.map((q) => ({ title: q.title, questionCount: q.questions.length, invalidQuestions: q.questions.filter((x) => !parseQuestion(x.type, x.config, x.answerKey).ok).length })),
  });
}

/** "Send for review" (admins: publish). */
export async function submitCourseAs(actor: CourseActor, courseId: string): Promise<Res<{ status: CourseStatus }>> {
  const own = await loadOwned(actor, courseId);
  if ("error" in own) return own;
  const problems = await readinessOf(courseId);
  if (problems.length) return { error: problems.join(" · ") };
  const now = new Date();
  const status = courseStatusAfterSave(actor, own.course.status, true);
  const c = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { publishedAt: true } });
  await db.course.update({
    where: { id: courseId },
    data: { status, reviewNote: null, publishedAt: status === "PUBLISHED" ? c.publishedAt ?? now : c.publishedAt, ...(actor.role === "ADMIN" && status === "PUBLISHED" ? { reviewedById: actor.id, reviewedAt: now } : {}) },
  });
  await audit({ actorId: actor.id, action: status === "PUBLISHED" ? "course.publish" : "course.submit", entity: "Course", entityId: courseId });
  return { ok: true, status };
}

/** Take a course that is waiting for review back to a draft (the author changed their mind). */
export async function withdrawCourseAs(actor: CourseActor, courseId: string): Promise<Res> {
  const own = await loadOwned(actor, courseId);
  if ("error" in own) return own;
  if (own.course.status !== "PENDING") return { error: "ถอนได้เฉพาะคอร์สที่รอตรวจ" };
  await db.course.update({ where: { id: courseId }, data: { status: "DRAFT" } });
  await audit({ actorId: actor.id, action: "course.withdraw", entity: "Course", entityId: courseId });
  return { ok: true };
}

/** Delete a course nobody has enrolled in (a course with learners is switched off instead). */
export async function deleteCourseAs(actor: CourseActor, courseId: string): Promise<Res> {
  const own = await loadOwned(actor, courseId);
  if ("error" in own) return own;
  if (actor.role !== "ADMIN" && own.course.status === "PUBLISHED") return { error: "คอร์สที่เผยแพร่แล้วลบเองไม่ได้ — ติดต่อผู้ดูแลระบบ" };
  if (await db.enrollment.count({ where: { courseId } })) return { error: "มีผู้ลงทะเบียนเรียนแล้ว ลบไม่ได้ — ให้ปิดรับสมัครหรือยกเลิกการเผยแพร่แทน" };
  await db.course.delete({ where: { id: courseId } });
  await safeDelete([own.course.coverKey]);
  await audit({ actorId: actor.id, action: "course.delete", entity: "Course", entityId: courseId });
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------ lessons
const lessonSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกชื่อบทเรียน").max(120),
  summary: z.string().trim().max(1000).default(""),
  unlockRule: z.enum(["OPEN", "AFTER_PREVIOUS"]).default("OPEN"),
  required: z.boolean().default(true),
  sectionTitle: z.string().trim().max(100).default(""),
});

/** Sections are only headings: a lesson names its section, and consecutive lessons with the same name share one heading. */
async function sectionFor(courseId: string, title: string): Promise<string | null> {
  if (!title) return null;
  const found = await db.courseSection.findFirst({ where: { courseId, title }, select: { id: true } });
  if (found) return found.id;
  const last = await db.courseSection.aggregate({ where: { courseId }, _max: { sortOrder: true } });
  return (await db.courseSection.create({ data: { courseId, title, sortOrder: (last._max.sortOrder ?? 0) + 1 }, select: { id: true } })).id;
}

export async function addLessonAs(actor: CourseActor, courseId: string, title: string): Promise<Res<{ id: string }>> {
  const own = await loadOwned(actor, courseId);
  if ("error" in own) return own;
  if (tooMany(actor)) return { error: "แก้ไขบ่อยเกินไป กรุณารอสักครู่" };
  const t = title.trim();
  if (!t) return { error: "กรุณากรอกชื่อบทเรียน" };
  if (t.length > 120) return { error: "ชื่อบทเรียนยาวเกินไป" };
  if ((await db.lesson.count({ where: { courseId } })) >= MAX_LESSONS) return { error: `คอร์สหนึ่งมีบทเรียนได้ไม่เกิน ${MAX_LESSONS} บท` };
  const last = await db.lesson.aggregate({ where: { courseId }, _max: { position: true } });
  const prev = last._max.position === null ? null : await db.lesson.findFirst({ where: { courseId, position: last._max.position ?? 0 }, select: { sectionId: true } });
  const lesson = await db.lesson.create({ data: { courseId, title: t, position: (last._max.position ?? 0) + 1, sectionId: prev?.sectionId ?? null }, select: { id: true } });
  await touch(actor, courseId, own.course.status);
  return { ok: true, id: lesson.id };
}

export async function updateLessonAs(actor: CourseActor, lessonId: string, input: unknown): Promise<Res> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, courseId: true } });
  if (!lesson) return NOT_FOUND;
  const own = await loadOwned(actor, lesson.courseId);
  if ("error" in own) return own;
  const p = lessonSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  if (tooMany(actor)) return { error: "แก้ไขบ่อยเกินไป กรุณารอสักครู่" };
  const sectionId = await sectionFor(lesson.courseId, p.data.sectionTitle);
  await db.lesson.update({ where: { id: lessonId }, data: { title: p.data.title, summary: p.data.summary, unlockRule: p.data.unlockRule, required: p.data.required, sectionId } });
  await db.courseSection.deleteMany({ where: { courseId: lesson.courseId, lessons: { none: {} } } }); // headings nobody uses any more
  await touch(actor, lesson.courseId, own.course.status);
  return { ok: true };
}

export async function deleteLessonAs(actor: CourseActor, lessonId: string): Promise<Res> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, courseId: true } });
  if (!lesson) return NOT_FOUND;
  const own = await loadOwned(actor, lesson.courseId);
  if ("error" in own) return own;
  await db.lesson.delete({ where: { id: lessonId } });
  const rest = await db.lesson.findMany({ where: { courseId: lesson.courseId }, orderBy: { position: "asc" }, select: { id: true } });
  await db.$transaction(rest.map((l, i) => db.lesson.update({ where: { id: l.id }, data: { position: i + 1 } })));
  await db.courseSection.deleteMany({ where: { courseId: lesson.courseId, lessons: { none: {} } } });
  await touch(actor, lesson.courseId, own.course.status);
  return { ok: true };
}

/** One step earlier / later; the whole list is renumbered 1..n so the order is always clean. */
export async function moveLessonAs(actor: CourseActor, lessonId: string, direction: "up" | "down"): Promise<Res> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, courseId: true } });
  if (!lesson) return NOT_FOUND;
  const own = await loadOwned(actor, lesson.courseId);
  if ("error" in own) return own;
  const list = await db.lesson.findMany({ where: { courseId: lesson.courseId }, orderBy: { position: "asc" }, select: { id: true } });
  const i = list.findIndex((x) => x.id === lessonId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((l, n) => db.lesson.update({ where: { id: l.id }, data: { position: n + 1 } })));
  await touch(actor, lesson.courseId, own.course.status);
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------ blocks
async function blockContext(actor: CourseActor, lessonId: string): Promise<Failure | { lesson: { id: string; courseId: string }; course: OwnedCourse }> {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, courseId: true } });
  if (!lesson) return { error: NOT_FOUND.error };
  const own = await loadOwned(actor, lesson.courseId);
  if ("error" in own) return own;
  return { lesson, course: own.course };
}

/** The parts that need the database: a library item must be published, a quiz must belong to this course. */
async function checkRefs(courseId: string, b: { mediaId: string | null; quizId: string | null }): Promise<string | null> {
  if (b.mediaId && !(await db.media.findFirst({ where: { id: b.mediaId, status: "PUBLISHED" }, select: { id: true } }))) return "ไม่พบสื่อนี้ในคลังสื่อ หรือสื่อยังไม่ได้เผยแพร่";
  if (b.quizId && !(await db.quiz.findFirst({ where: { id: b.quizId, courseId }, select: { id: true } }))) return "ไม่พบแบบทดสอบนี้ในคอร์ส";
  return null;
}

export async function addBlockAs(actor: CourseActor, lessonId: string, input: BlockInput): Promise<Res<{ id: string }>> {
  const ctx = await blockContext(actor, lessonId);
  if ("error" in ctx) return ctx;
  if (tooMany(actor)) return { error: "แก้ไขบ่อยเกินไป กรุณารอสักครู่" };
  const c = cleanBlock(input);
  if (!c.ok) return c;
  const refErr = await checkRefs(ctx.lesson.courseId, c.block);
  if (refErr) return { error: refErr };
  if ((await db.lessonBlock.count({ where: { lessonId } })) >= MAX_BLOCKS_PER_LESSON) return { error: `บทเรียนหนึ่งมีเนื้อหาได้ไม่เกิน ${MAX_BLOCKS_PER_LESSON} ส่วน` };
  if (c.block.kind === "HTML" && (await db.lessonBlock.count({ where: { lessonId, kind: "HTML" } })) >= MAX_HTML_BLOCKS_PER_LESSON) return { error: `บทเรียนหนึ่งมีบล็อก HTML ได้ไม่เกิน ${MAX_HTML_BLOCKS_PER_LESSON} ส่วน (ฐานข้อมูลเก็บเนื้อหา HTML ทั้งหมด) — รวมไว้ในบล็อกเดียว หรือแยกเป็นอีกบท` };
  const last = await db.lessonBlock.aggregate({ where: { lessonId }, _max: { sortOrder: true } });
  const b = await db.lessonBlock.create({ data: { ...c.block, lessonId, sortOrder: (last._max.sortOrder ?? 0) + 1 }, select: { id: true } });
  await touch(actor, ctx.lesson.courseId, ctx.course.status);
  return { ok: true, id: b.id };
}

export async function updateBlockAs(actor: CourseActor, blockId: string, input: BlockInput): Promise<Res> {
  const block = await db.lessonBlock.findUnique({ where: { id: blockId }, select: { id: true, lessonId: true, kind: true } });
  if (!block) return NOT_FOUND;
  const ctx = await blockContext(actor, block.lessonId);
  if ("error" in ctx) return ctx;
  if (input.kind !== block.kind) return { error: "เปลี่ยนชนิดเนื้อหาไม่ได้ — ลบแล้วเพิ่มใหม่" };
  const c = cleanBlock(input);
  if (!c.ok) return c;
  const refErr = await checkRefs(ctx.lesson.courseId, c.block);
  if (refErr) return { error: refErr };
  await db.lessonBlock.update({ where: { id: blockId }, data: c.block });
  await touch(actor, ctx.lesson.courseId, ctx.course.status);
  return { ok: true };
}

export async function deleteBlockAs(actor: CourseActor, blockId: string): Promise<Res> {
  const block = await db.lessonBlock.findUnique({ where: { id: blockId }, select: { id: true, lessonId: true } });
  if (!block) return NOT_FOUND;
  const ctx = await blockContext(actor, block.lessonId);
  if ("error" in ctx) return ctx;
  await db.lessonBlock.delete({ where: { id: blockId } });
  await touch(actor, ctx.lesson.courseId, ctx.course.status);
  return { ok: true };
}

export async function moveBlockAs(actor: CourseActor, blockId: string, direction: "up" | "down"): Promise<Res> {
  const block = await db.lessonBlock.findUnique({ where: { id: blockId }, select: { id: true, lessonId: true } });
  if (!block) return NOT_FOUND;
  const ctx = await blockContext(actor, block.lessonId);
  if ("error" in ctx) return ctx;
  const list = await db.lessonBlock.findMany({ where: { lessonId: block.lessonId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const i = list.findIndex((x) => x.id === blockId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, n) => db.lessonBlock.update({ where: { id: x.id }, data: { sortOrder: n + 1 } })));
  await touch(actor, ctx.lesson.courseId, ctx.course.status);
  return { ok: true };
}

// ------------------------------------------------------------------------------------------------ quizzes and questions
const quizSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกชื่อแบบทดสอบ").max(120),
  passPercent: z.number().int().min(1, "เกณฑ์ผ่านต้อง 1–100%").max(100, "เกณฑ์ผ่านต้อง 1–100%"),
  maxAttempts: z.number().int().min(1, "จำนวนครั้งที่ทำได้ต้อง 1–50").max(50, "จำนวนครั้งที่ทำได้ต้อง 1–50").nullable(),
  timeLimitMin: z.number().int().min(1, "เวลาที่ให้ทำต้อง 1–300 นาที").max(300, "เวลาที่ให้ทำต้อง 1–300 นาที").nullable(),
  shuffleQuestions: z.boolean(),
  shuffleChoices: z.boolean(),
  showAnswers: z.enum(["NEVER", "AFTER_PASS", "EACH_ATTEMPT"]),
});
export type QuizSettings = z.infer<typeof quizSchema>;

/** `unlock` = an "unlock question" set: must be answered 100 % right, unlimited tries, answers never shown (so retrying means thinking, not copying). */
export async function createQuizAs(actor: CourseActor, courseId: string, title: string, unlock = false): Promise<Res<{ id: string }>> {
  const own = await loadOwned(actor, courseId);
  if ("error" in own) return own;
  if (tooMany(actor)) return { error: "แก้ไขบ่อยเกินไป กรุณารอสักครู่" };
  const t = title.trim();
  if (!t) return { error: "กรุณากรอกชื่อแบบทดสอบ" };
  if ((await db.quiz.count({ where: { courseId } })) >= 60) return { error: "คอร์สหนึ่งมีแบบทดสอบได้ไม่เกิน 60 ชุด" };
  const q = await db.quiz.create({ data: { courseId, title: t.slice(0, 120), ...(unlock && { passPercent: 100, maxAttempts: null, timeLimitMin: null, shuffleQuestions: true, shuffleChoices: true, showAnswers: "NEVER" as const }) }, select: { id: true } });
  await touch(actor, courseId, own.course.status);
  return { ok: true, id: q.id };
}

async function quizContext(actor: CourseActor, quizId: string): Promise<Failure | { quiz: { id: string; courseId: string }; course: OwnedCourse }> {
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { id: true, courseId: true } });
  if (!quiz) return { error: NOT_FOUND.error };
  const own = await loadOwned(actor, quiz.courseId);
  if ("error" in own) return own;
  return { quiz, course: own.course };
}

export async function updateQuizAs(actor: CourseActor, quizId: string, input: unknown): Promise<Res> {
  const ctx = await quizContext(actor, quizId);
  if ("error" in ctx) return ctx;
  const p = quizSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  await db.quiz.update({ where: { id: quizId }, data: p.data });
  await touch(actor, ctx.quiz.courseId, ctx.course.status);
  return { ok: true };
}

export async function deleteQuizAs(actor: CourseActor, quizId: string): Promise<Res> {
  const ctx = await quizContext(actor, quizId);
  if ("error" in ctx) return ctx;
  if (await db.lessonBlock.count({ where: { quizId } })) return { error: "แบบทดสอบนี้ถูกใช้อยู่ในบทเรียน — เอาออกจากบทเรียนก่อน" };
  if (await db.quizAttempt.count({ where: { quizId } })) return { error: "มีผู้เรียนทำแบบทดสอบนี้แล้ว ลบไม่ได้" };
  await db.quiz.delete({ where: { id: quizId } });
  await touch(actor, ctx.quiz.courseId, ctx.course.status);
  return { ok: true };
}

const questionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  points: z.number().int().min(1, "คะแนนต่อข้อต้อง 1–100").max(100, "คะแนนต่อข้อต้อง 1–100"),
  prompt: z.string().trim().min(1, "กรุณาพิมพ์คำถาม").max(2000, "คำถามยาวเกินไป"),
  imageUrl: z.string().trim().max(600).default(""),
  explanation: z.string().trim().max(2000).default(""),
  config: z.unknown(),
  answerKey: z.unknown(),
});

/** An image link in a question: a public Drive file (shown through its thumbnail) or any https image address. */
function cleanImage(raw: string): { ok: true; url: string | null } | { ok: false; error: string } {
  if (!raw) return { ok: true, url: null };
  const drive = parseDriveFileId(raw);
  if (drive) return { ok: true, url: driveThumbnailUrl(drive, 1200) };
  const r = safeHttpsUrl(raw);
  return "error" in r ? { ok: false, error: `ลิงก์รูปในคำถาม: ${r.error}` } : { ok: true, url: r.url };
}

export async function saveQuestionAs(actor: CourseActor, quizId: string, questionId: string | null, input: unknown): Promise<Res<{ id: string }>> {
  const ctx = await quizContext(actor, quizId);
  if ("error" in ctx) return ctx;
  const p = questionSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const q = parseQuestion(p.data.type, p.data.config, p.data.answerKey);
  if (!q.ok) return { error: q.error };
  const img = cleanImage(p.data.imageUrl);
  if (!img.ok) return img;
  if (tooMany(actor)) return { error: "แก้ไขบ่อยเกินไป กรุณารอสักครู่" };
  const data = { type: q.value.type, points: p.data.points, prompt: p.data.prompt, imageUrl: img.url, explanation: p.data.explanation, config: q.value.config as object, answerKey: q.value.answerKey as object };
  let id: string;
  if (questionId) {
    const old = await db.question.findFirst({ where: { id: questionId, quizId }, select: { id: true } });
    if (!old) return NOT_FOUND;
    await db.question.update({ where: { id: questionId }, data });
    id = questionId;
  } else {
    if ((await db.question.count({ where: { quizId } })) >= MAX_QUESTIONS_PER_QUIZ) return { error: `แบบทดสอบหนึ่งมีคำถามได้ไม่เกิน ${MAX_QUESTIONS_PER_QUIZ} ข้อ` };
    const last = await db.question.aggregate({ where: { quizId }, _max: { sortOrder: true } });
    id = (await db.question.create({ data: { ...data, quizId, sortOrder: (last._max.sortOrder ?? 0) + 1 }, select: { id: true } })).id;
  }
  await touch(actor, ctx.quiz.courseId, ctx.course.status);
  return { ok: true, id };
}

/**
 * Add many multiple-choice questions at once (the Excel import). Every question goes through the same checks as one saved
 * by hand (`questionSchema`, `parseQuestion`, `cleanImage`); the ones that fail are skipped and reported, the rest are added
 * after the questions already there, in one transaction. Counts as ONE edit for the hourly limit.
 */
export async function importQuestionsAs(actor: CourseActor, quizId: string, inputs: unknown): Promise<Res<{ imported: number; skipped: { index: number; error: string }[] }>> {
  const ctx = await quizContext(actor, quizId);
  if ("error" in ctx) return ctx;
  if (!Array.isArray(inputs) || inputs.length === 0) return { error: "ไม่มีคำถามให้นำเข้า" };
  if (inputs.length > MAX_QUESTIONS_PER_QUIZ) return { error: `นำเข้าได้ครั้งละไม่เกิน ${MAX_QUESTIONS_PER_QUIZ} ข้อ` };
  const existing = await db.question.count({ where: { quizId } });
  if (existing + inputs.length > MAX_QUESTIONS_PER_QUIZ) return { error: `แบบทดสอบนี้มีคำถามอยู่แล้ว ${existing} ข้อ นำเข้าเพิ่มได้อีกไม่เกิน ${MAX_QUESTIONS_PER_QUIZ - existing} ข้อ (สูงสุด ${MAX_QUESTIONS_PER_QUIZ} ข้อต่อแบบทดสอบ)` };
  if (tooMany(actor)) return { error: "แก้ไขบ่อยเกินไป กรุณารอสักครู่" };

  const skipped: { index: number; error: string }[] = [];
  const rows: { type: "SINGLE" | "MULTI"; points: number; prompt: string; imageUrl: string | null; explanation: string; config: object; answerKey: object }[] = [];
  inputs.forEach((raw, index) => {
    const p = questionSchema.safeParse(raw);
    if (!p.success) return skipped.push({ index, error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" });
    if (p.data.type !== "SINGLE" && p.data.type !== "MULTI") return skipped.push({ index, error: "นำเข้าได้เฉพาะข้อสอบปรนัย" });
    const q = parseQuestion(p.data.type, p.data.config, p.data.answerKey);
    if (!q.ok) return skipped.push({ index, error: q.error });
    const img = cleanImage(p.data.imageUrl);
    if (!img.ok) return skipped.push({ index, error: img.error });
    rows.push({ type: p.data.type, points: p.data.points, prompt: p.data.prompt, imageUrl: img.url, explanation: p.data.explanation, config: q.value.config as object, answerKey: q.value.answerKey as object });
  });
  if (rows.length === 0) return { error: skipped[0]?.error ?? "ไม่มีคำถามที่นำเข้าได้" };

  await db.$transaction(async (tx) => {
    const last = await tx.question.aggregate({ where: { quizId }, _max: { sortOrder: true } });
    const base = last._max.sortOrder ?? 0;
    await tx.question.createMany({ data: rows.map((r, i) => ({ ...r, quizId, sortOrder: base + i + 1 })) });
  });
  await touch(actor, ctx.quiz.courseId, ctx.course.status);
  return { ok: true, imported: rows.length, skipped };
}

export async function deleteQuestionAs(actor: CourseActor, questionId: string): Promise<Res> {
  const q = await db.question.findUnique({ where: { id: questionId }, select: { id: true, quizId: true } });
  if (!q) return NOT_FOUND;
  const ctx = await quizContext(actor, q.quizId);
  if ("error" in ctx) return ctx;
  await db.question.delete({ where: { id: questionId } });
  await touch(actor, ctx.quiz.courseId, ctx.course.status);
  return { ok: true };
}

export async function moveQuestionAs(actor: CourseActor, questionId: string, direction: "up" | "down"): Promise<Res> {
  const q = await db.question.findUnique({ where: { id: questionId }, select: { id: true, quizId: true } });
  if (!q) return NOT_FOUND;
  const ctx = await quizContext(actor, q.quizId);
  if ("error" in ctx) return ctx;
  const list = await db.question.findMany({ where: { quizId: q.quizId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const i = list.findIndex((x) => x.id === questionId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, n) => db.question.update({ where: { id: x.id }, data: { sortOrder: n + 1 } })));
  await touch(actor, ctx.quiz.courseId, ctx.course.status);
  return { ok: true };
}
