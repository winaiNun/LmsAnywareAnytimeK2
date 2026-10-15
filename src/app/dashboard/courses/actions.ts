"use server";

import { revalidatePath } from "next/cache";
import { MAX_QUESTIONS_PER_QUIZ, canEditCourse, type CourseActor } from "@/lib/course/access";
import { QUIZ_SHEET_NAME, parseQuizSheet, type ImportRow } from "@/lib/course/quiz/import";
import { readSpreadsheet } from "@/lib/excel";
import { gradeQuiz, type QuestionRow } from "@/lib/course/quiz/grade";
import { buildOutcome, type QuizOutcome } from "@/lib/course/quiz/reveal";
import type { BlockInput } from "@/lib/course/blocks";
import * as save from "@/lib/course/course-save";
import { getCourseActor } from "@/lib/course/course-server";

const NOT_SIGNED_IN = { error: "กรุณาเข้าสู่ระบบ" } as const;

function refresh(courseId?: string) {
  revalidatePath("/dashboard/courses");
  revalidatePath("/courses");
  revalidatePath("/");
  if (courseId) {
    revalidatePath(`/dashboard/courses/${courseId}/edit`);
    revalidatePath(`/courses/${courseId}`);
  }
}

/** Runs one author operation as the signed-in member and refreshes the pages that show courses. */
async function run<T>(courseId: string | null, fn: (actor: CourseActor) => Promise<T>): Promise<T | typeof NOT_SIGNED_IN> {
  const actor = await getCourseActor();
  if (!actor) return NOT_SIGNED_IN;
  const r = await fn(actor);
  refresh(courseId ?? undefined);
  return r;
}

export async function saveCourseInfo(courseId: string | null, formData: FormData) {
  return run(courseId, (a) => save.saveCourseInfoAs(a, courseId, formData));
}
export async function submitCourse(courseId: string) {
  return run(courseId, (a) => save.submitCourseAs(a, courseId));
}
export async function withdrawCourse(courseId: string) {
  return run(courseId, (a) => save.withdrawCourseAs(a, courseId));
}
export async function deleteCourse(courseId: string) {
  return run(courseId, (a) => save.deleteCourseAs(a, courseId));
}

export async function addLesson(courseId: string, title: string) {
  return run(courseId, (a) => save.addLessonAs(a, courseId, title));
}
export async function updateLesson(courseId: string, lessonId: string, input: unknown) {
  return run(courseId, (a) => save.updateLessonAs(a, lessonId, input));
}
export async function deleteLesson(courseId: string, lessonId: string) {
  return run(courseId, (a) => save.deleteLessonAs(a, lessonId));
}
export async function moveLesson(courseId: string, lessonId: string, direction: "up" | "down") {
  return run(courseId, (a) => save.moveLessonAs(a, lessonId, direction));
}

export async function addBlock(courseId: string, lessonId: string, input: BlockInput) {
  return run(courseId, (a) => save.addBlockAs(a, lessonId, input));
}
export async function updateBlock(courseId: string, blockId: string, input: BlockInput) {
  return run(courseId, (a) => save.updateBlockAs(a, blockId, input));
}
export async function deleteBlock(courseId: string, blockId: string) {
  return run(courseId, (a) => save.deleteBlockAs(a, blockId));
}
export async function moveBlock(courseId: string, blockId: string, direction: "up" | "down") {
  return run(courseId, (a) => save.moveBlockAs(a, blockId, direction));
}

export async function createQuiz(courseId: string, title: string, unlock = false) {
  return run(courseId, (a) => save.createQuizAs(a, courseId, title, unlock));
}
export async function updateQuiz(courseId: string, quizId: string, input: unknown) {
  return run(courseId, (a) => save.updateQuizAs(a, quizId, input));
}
export async function deleteQuiz(courseId: string, quizId: string) {
  return run(courseId, (a) => save.deleteQuizAs(a, quizId));
}
export async function saveQuestion(courseId: string, quizId: string, questionId: string | null, input: unknown) {
  return run(courseId, (a) => save.saveQuestionAs(a, quizId, questionId, input));
}
export async function deleteQuestion(courseId: string, questionId: string) {
  return run(courseId, (a) => save.deleteQuestionAs(a, questionId));
}
export async function moveQuestion(courseId: string, questionId: string, direction: "up" | "down") {
  return run(courseId, (a) => save.moveQuestionAs(a, questionId, direction));
}

/** Library search for the "media from the library" content block: published items only, by title or tag. */
export async function searchMediaForCourse(query: string): Promise<{ id: string; title: string; area: string }[]> {
  const actor = await getCourseActor();
  if (!actor) return [];
  const q = query.trim().slice(0, 60);
  const { db } = await import("@/lib/db");
  const rows = await db.media.findMany({
    where: { status: "PUBLISHED", ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { tags: { has: q } }] } : {}) },
    orderBy: [{ viewCount: "desc" }, { publishedAt: "desc" }],
    take: 8,
    select: { id: true, title: true, area: { select: { name: true } } },
  });
  return rows.map((m) => ({ id: m.id, title: m.title, area: m.area.name }));
}

/** Author's "try it": grade a set of answers against the real key without saving anything (shows the key and the explanations). */
export async function previewQuiz(courseId: string, quizId: string, answers: Record<string, unknown>): Promise<{ outcome: QuizOutcome } | { error: string }> {
  const actor = await getCourseActor();
  if (!actor) return NOT_SIGNED_IN;
  const { db } = await import("@/lib/db");
  const quiz = await db.quiz.findFirst({ where: { id: quizId, courseId }, include: { questions: { orderBy: { sortOrder: "asc" } }, course: { select: { createdById: true, areaId: true } } } });
  if (!quiz || !canEditCourse(actor, quiz.course)) return { error: "ไม่มีสิทธิ์ดูตัวอย่างแบบทดสอบนี้" };
  const rows = quiz.questions as unknown as QuestionRow[];
  const result = gradeQuiz(rows, answers as never, quiz.passPercent);
  return { outcome: buildOutcome(rows, result, quiz.passPercent, true) };
}

// ---- Excel import of multiple-choice questions: 1) read + check the file (nothing saved)  2) save what is valid ----

export type QuestionImportPreview =
  | { ok: false; error: string }
  | { ok: true; fileName: string; rows: ImportRow[]; exampleRows: number; valid: number; invalid: number; room: number };

export async function previewQuestionImport(courseId: string, quizId: string, formData: FormData): Promise<QuestionImportPreview> {
  const actor = await getCourseActor();
  if (!actor) return { ok: false, ...NOT_SIGNED_IN };
  const { db } = await import("@/lib/db");
  const quiz = await db.quiz.findFirst({ where: { id: quizId, courseId }, select: { course: { select: { createdById: true, areaId: true } }, _count: { select: { questions: true } } } });
  if (!quiz || !canEditCourse(actor, quiz.course)) return { ok: false, error: "ไม่มีสิทธิ์แก้ไขแบบทดสอบนี้" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "กรุณาเลือกไฟล์ .xlsx หรือ .csv" };
  let rows: string[][];
  try {
    rows = (await readSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name, QUIZ_SHEET_NAME)).rows;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "อ่านไฟล์ไม่ได้" };
  }
  const parsed = parseQuizSheet(rows);
  if (!parsed.ok) return parsed;
  if (parsed.rows.length > 300) return { ok: false, error: "ไฟล์มีข้อสอบมากเกิน 300 แถว — แบ่งเป็นหลายไฟล์ (แบบทดสอบหนึ่งชุดมีได้ไม่เกิน 100 ข้อ)" };
  return { ok: true, fileName: file.name, rows: parsed.rows, exampleRows: parsed.exampleRows, valid: parsed.valid, invalid: parsed.invalid, room: Math.max(0, MAX_QUESTIONS_PER_QUIZ - quiz._count.questions) };
}

export async function importQuestions(courseId: string, quizId: string, inputs: unknown) {
  return run(courseId, (a) => save.importQuestionsAs(a, quizId, inputs));
}
