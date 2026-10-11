/**
 * What a learner does inside a course: open lessons (only the ones the rules open), report video watching, confirm a
 * lesson, take quizzes. Every function takes the user id (and never calls Next-only cache APIs) so it can be tested
 * against the real database. Every one of them checks again, on the server, that the learner is enrolled in a
 * published course and that the lesson is open: the browser's own hiding of locked lessons is only for convenience.
 */
import { randomInt } from "node:crypto";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { rateLimited } from "@/lib/rate-limit";
import { courseProgress, doneLessonIds, isLessonDone, isLessonUnlocked, needsConfirm, nextLesson, type BlockFacts, type LearnerFacts, type LessonFacts } from "./rules";
import { gradeQuiz, type QuestionRow } from "./quiz/grade";
import { presentQuiz, type PublicQuestion } from "./quiz/present";
import { buildOutcome, type QuizOutcome } from "./quiz/reveal";
import { applyWatchReport, type Segment } from "./watch";

type Res<T extends object = object> = ({ ok: true } & T) | { error: string };

export type LearnLesson = LessonFacts & { title: string; position: number; summary: string; sectionTitle: string | null };
export type CourseState = {
  course: { id: string; title: string; status: string; enrollOpen: boolean };
  lessons: LearnLesson[];
  learner: LearnerFacts;
  done: Set<string>;
  enrollment: { id: string; progress: number; completedAt: Date | null; lastLessonId: string | null } | null;
};

/** The lessons of a course in order, with everything the rules need, plus what this learner has done. */
export async function loadCourseState(userId: string, courseId: string): Promise<CourseState | null> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true, title: true, status: true, enrollOpen: true,
      lessons: { orderBy: { position: "asc" }, select: { id: true, title: true, position: true, summary: true, unlockRule: true, required: true, section: { select: { title: true } }, blocks: { orderBy: { sortOrder: "asc" }, select: { id: true, kind: true, required: true, minPercent: true, quizId: true } } } },
    },
  });
  if (!course) return null;
  const [enrollment, progress, blocks, passed] = await Promise.all([
    db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { id: true, progress: true, completedAt: true, lastLessonId: true } }),
    db.lessonProgress.findMany({ where: { userId, lesson: { courseId } }, select: { lessonId: true, confirmed: true } }),
    db.blockProgress.findMany({ where: { userId, block: { lesson: { courseId } } }, select: { blockId: true, watchPercent: true } }),
    db.quizAttempt.findMany({ where: { userId, passed: true, quiz: { courseId } }, select: { quizId: true }, distinct: ["quizId"] }),
  ]);
  const lessons: LearnLesson[] = course.lessons.map((l) => ({ id: l.id, title: l.title, position: l.position, summary: l.summary, sectionTitle: l.section?.title ?? null, unlockRule: l.unlockRule, required: l.required, blocks: l.blocks as BlockFacts[] }));
  const learner: LearnerFacts = {
    confirmed: new Set(progress.filter((p) => p.confirmed).map((p) => p.lessonId)),
    watch: Object.fromEntries(blocks.map((b) => [b.blockId, b.watchPercent])),
    passedQuizzes: new Set(passed.map((p) => p.quizId)),
  };
  return { course: { id: course.id, title: course.title, status: course.status, enrollOpen: course.enrollOpen }, lessons, learner, done: doneLessonIds(lessons, learner), enrollment };
}

export type Access = { ok: true; state: CourseState; lesson: LearnLesson; index: number } | { ok: false; reason: "no-course" | "not-published" | "not-enrolled" | "no-lesson" | "locked"; state?: CourseState; lessonIndex?: number };

/** May this member open this lesson right now? */
export async function accessLesson(userId: string, courseId: string, lessonId: string): Promise<Access> {
  const state = await loadCourseState(userId, courseId);
  if (!state) return { ok: false, reason: "no-course" };
  if (state.course.status !== "PUBLISHED") return { ok: false, reason: "not-published", state };
  if (!state.enrollment) return { ok: false, reason: "not-enrolled", state };
  const index = state.lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) return { ok: false, reason: "no-lesson", state };
  if (!isLessonUnlocked(state.lessons, index, state.done)) return { ok: false, reason: "locked", state, lessonIndex: index };
  return { ok: true, state, lesson: state.lessons[index], index };
}

const REASON: Record<string, string> = {
  "no-course": "ไม่พบคอร์สนี้",
  "not-published": "คอร์สนี้ยังไม่เปิดให้เรียน",
  "not-enrolled": "ยังไม่ได้ลงทะเบียนเรียนคอร์สนี้",
  "no-lesson": "ไม่พบบทเรียนนี้",
  locked: "ต้องเรียนบทก่อนหน้าให้จบก่อน",
};
export const reasonText = (reason: string) => REASON[reason] ?? "เปิดบทเรียนนี้ไม่ได้";

/** Re-derive which lessons are done and store it (lesson rows, enrolment progress, completion date). */
export async function recomputeProgress(userId: string, courseId: string): Promise<{ progress: number; complete: boolean; done: string[] } | null> {
  const state = await loadCourseState(userId, courseId);
  if (!state || !state.enrollment) return null;
  const prog = courseProgress(state.lessons, state.done);
  const rows = await db.lessonProgress.findMany({ where: { userId, lesson: { courseId } }, select: { lessonId: true, status: true } });
  const have = new Map(rows.map((r) => [r.lessonId, r.status]));
  const now = new Date();
  const writes = [];
  for (const l of state.lessons) {
    const isDone = state.done.has(l.id);
    const current = have.get(l.id);
    if (isDone && current !== "DONE") writes.push(db.lessonProgress.upsert({ where: { userId_lessonId: { userId, lessonId: l.id } }, create: { userId, lessonId: l.id, status: "DONE", completedAt: now }, update: { status: "DONE", completedAt: now } }));
    else if (!isDone && current === "DONE") writes.push(db.lessonProgress.update({ where: { userId_lessonId: { userId, lessonId: l.id } }, data: { status: "STARTED", completedAt: null } }));
  }
  const e = state.enrollment;
  const completedAt = prog.complete ? e.completedAt ?? now : e.completedAt; // once complete, the date is kept
  if (writes.length || e.progress !== prog.percent || completedAt?.getTime() !== e.completedAt?.getTime()) {
    await db.$transaction([...writes, db.enrollment.update({ where: { id: e.id }, data: { progress: prog.percent, completedAt } })]);
    if (prog.complete && !e.completedAt) await audit({ actorId: userId, action: "course.complete", entity: "Course", entityId: courseId });
  }
  return { progress: prog.percent, complete: prog.complete, done: [...state.done] };
}

/** The learner opened a lesson: remember where they are (and that they started it). */
export async function touchLessonAs(userId: string, courseId: string, lessonId: string): Promise<void> {
  const [row, enr] = await Promise.all([
    db.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } }, select: { userId: true } }),
    db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { id: true, lastLessonId: true } }),
  ]);
  if (!enr) return;
  if (!row) await db.lessonProgress.create({ data: { userId, lessonId, status: "STARTED" } }).catch(() => {});
  if (enr.lastLessonId !== lessonId) await db.enrollment.update({ where: { id: enr.id }, data: { lastLessonId: lessonId } });
}

/** "I have studied this lesson". */
export async function confirmLessonAs(userId: string, courseId: string, lessonId: string): Promise<Res<{ done: boolean; progress: number; complete: boolean }>> {
  const a = await accessLesson(userId, courseId, lessonId);
  if (!a.ok) return { error: reasonText(a.reason) };
  if (!needsConfirm(a.lesson)) return { error: "บทนี้จบเองเมื่อทำครบเงื่อนไข ไม่ต้องกดยืนยัน" };
  await db.lessonProgress.upsert({ where: { userId_lessonId: { userId, lessonId } }, create: { userId, lessonId, status: "STARTED", confirmed: true }, update: { confirmed: true } });
  const r = await recomputeProgress(userId, courseId);
  return { ok: true, done: !!r?.done.includes(lessonId), progress: r?.progress ?? 0, complete: !!r?.complete };
}

// ------------------------------------------------------------------------------------------------ video watching
export async function reportWatchAs(userId: string, blockId: string, report: { durationSec: number; segments: Segment[] }, now: Date = new Date()): Promise<Res<{ percent: number; lessonDone: boolean; progress: number; complete: boolean }>> {
  if (rateLimited(`watch:${userId}:${blockId}`, 20, 5 * 60 * 1000)) return { error: "ส่งรายงานบ่อยเกินไป" };
  const block = await db.lessonBlock.findUnique({ where: { id: blockId }, select: { id: true, kind: true, lessonId: true, lesson: { select: { courseId: true } } } });
  if (!block || block.kind !== "VIDEO") return { error: "ไม่พบวิดีโอนี้" };
  const courseId = block.lesson.courseId;
  const a = await accessLesson(userId, courseId, block.lessonId);
  if (!a.ok) return { error: reasonText(a.reason) };

  // one learner, one video: two tabs reporting at once must not overwrite each other, so the row is locked while we merge
  const result = await db.$transaction(async (tx) => {
    // make sure the row exists (two first reports at once both try; one wins), then lock it while we merge
    await tx.$executeRaw`INSERT INTO "BlockProgress" ("userId", "blockId", "durationSec", "watchMap", "watchPercent", "lastReportAt", "updatedAt") VALUES (${userId}, ${blockId}, 0, '', 0, ${now}, ${now}) ON CONFLICT ("userId", "blockId") DO NOTHING`;
    await tx.$executeRaw`SELECT 1 FROM "BlockProgress" WHERE "userId" = ${userId} AND "blockId" = ${blockId} FOR UPDATE`;
    const prev = await tx.blockProgress.findUniqueOrThrow({ where: { userId_blockId: { userId, blockId } } });
    const r = applyWatchReport({ durationSec: prev.durationSec, map: prev.watchMap, lastReportAt: prev.durationSec > 0 ? prev.lastReportAt : null }, report, now);
    if (!r.ok) return r;
    await tx.blockProgress.update({ where: { userId_blockId: { userId, blockId } }, data: { durationSec: r.durationSec, watchMap: r.map, watchPercent: r.percent, lastReportAt: now } });
    return r;
  });
  if (!result.ok) return { error: result.error };
  const p = await recomputeProgress(userId, courseId);
  return { ok: true, percent: result.percent, lessonDone: !!p?.done.includes(block.lessonId), progress: p?.progress ?? 0, complete: !!p?.complete };
}

// ------------------------------------------------------------------------------------------------ quizzes
const GRACE_SECONDS = 20; // slack for the network when a time limit runs out

type QuizContext = { quiz: { id: string; courseId: string; title: string; passPercent: number; maxAttempts: number | null; timeLimitMin: number | null; shuffleQuestions: boolean; shuffleChoices: boolean; showAnswers: "NEVER" | "AFTER_PASS" | "EACH_ATTEMPT" }; lessonId: string };

/** The quiz must sit in a lesson (of its own course) that this learner may open. */
async function quizAccess(userId: string, quizId: string): Promise<Res<QuizContext>> {
  const quiz = await db.quiz.findUnique({ where: { id: quizId }, select: { id: true, courseId: true, title: true, passPercent: true, maxAttempts: true, timeLimitMin: true, shuffleQuestions: true, shuffleChoices: true, showAnswers: true, blocks: { select: { lessonId: true } } } });
  if (!quiz) return { error: "ไม่พบแบบทดสอบนี้" };
  let lastReason = "no-lesson";
  for (const b of quiz.blocks) {
    const a = await accessLesson(userId, quiz.courseId, b.lessonId);
    if (a.ok) return { ok: true, quiz, lessonId: b.lessonId };
    lastReason = a.reason;
  }
  return { error: reasonText(lastReason) };
}

export type QuizStatus = { attempts: number; maxAttempts: number | null; best: number | null; passed: boolean; open: { id: string; deadline: string | null } | null };

export async function quizStatusFor(userId: string, quizId: string, maxAttempts: number | null, timeLimitMin: number | null): Promise<QuizStatus> {
  const rows = await db.quizAttempt.findMany({ where: { userId, quizId }, select: { id: true, percent: true, passed: true, submittedAt: true, startedAt: true } });
  const submitted = rows.filter((r) => r.submittedAt);
  const open = rows.find((r) => !r.submittedAt && (!timeLimitMin || Date.now() < r.startedAt.getTime() + timeLimitMin * 60000 + GRACE_SECONDS * 1000));
  return {
    attempts: submitted.length,
    maxAttempts,
    best: submitted.length ? Math.max(...submitted.map((r) => r.percent)) : null,
    passed: submitted.some((r) => r.passed),
    open: open ? { id: open.id, deadline: timeLimitMin ? new Date(open.startedAt.getTime() + timeLimitMin * 60000).toISOString() : null } : null,
  };
}

/** Start (or resume) an attempt. The questions come back without their answer keys. */
export async function startAttemptAs(userId: string, quizId: string): Promise<Res<{ attemptId: string; questions: PublicQuestion[]; deadline: string | null; attemptNo: number }>> {
  const ctx = await quizAccess(userId, quizId);
  if ("error" in ctx) return ctx;
  const { quiz } = ctx;
  if (rateLimited(`quiz-start:${userId}`, 30, 60 * 60 * 1000)) return { error: "เริ่มทำแบบทดสอบบ่อยเกินไป กรุณารอสักครู่" };
  const questions = (await db.question.findMany({ where: { quizId }, orderBy: { sortOrder: "asc" } })) as unknown as QuestionRow[];
  if (questions.length === 0) return { error: "แบบทดสอบนี้ยังไม่มีคำถาม" };

  const now = new Date();
  const attempts = await db.quizAttempt.findMany({ where: { userId, quizId }, orderBy: { startedAt: "desc" } });
  // an attempt whose time ran out and was never handed in counts as used (graded 0)
  for (const a of attempts) {
    if (!a.submittedAt && quiz.timeLimitMin && now.getTime() > a.startedAt.getTime() + quiz.timeLimitMin * 60000 + GRACE_SECONDS * 1000) {
      await db.quizAttempt.update({ where: { id: a.id }, data: { submittedAt: now, score: 0, maxScore: questions.reduce((n, x) => n + x.points, 0), percent: 0, passed: false, result: { expired: true } } });
      a.submittedAt = now;
    }
  }
  const open = attempts.find((a) => !a.submittedAt);
  const used = attempts.filter((a) => a.submittedAt).length;
  const present = (seed: number) => presentQuiz(questions, { seed, shuffleQuestions: quiz.shuffleQuestions, shuffleChoices: quiz.shuffleChoices });
  if (open) {
    return { ok: true, attemptId: open.id, questions: present(open.seed), deadline: quiz.timeLimitMin ? new Date(open.startedAt.getTime() + quiz.timeLimitMin * 60000).toISOString() : null, attemptNo: used + 1 };
  }
  if (quiz.maxAttempts !== null && used >= quiz.maxAttempts) return { error: `ทำแบบทดสอบนี้ครบ ${quiz.maxAttempts} ครั้งแล้ว` };
  const attempt = await db.quizAttempt.create({ data: { quizId, userId, seed: randomInt(1, 2 ** 31 - 1) } });
  return { ok: true, attemptId: attempt.id, questions: present(attempt.seed), deadline: quiz.timeLimitMin ? new Date(attempt.startedAt.getTime() + quiz.timeLimitMin * 60000).toISOString() : null, attemptNo: used + 1 };
}

/** Grade an attempt on the server. The answers can be handed in once; the result tells the learner what the quiz allows. */
export async function submitAttemptAs(userId: string, attemptId: string, answers: Record<string, unknown>, now: Date = new Date()): Promise<Res<{ outcome: QuizOutcome; expired: boolean; progress: number; complete: boolean }>> {
  const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) return { error: "ไม่พบการทำแบบทดสอบนี้" };
  if (attempt.submittedAt) return { error: "ส่งคำตอบของครั้งนี้ไปแล้ว" };
  const ctx = await quizAccess(userId, attempt.quizId);
  if ("error" in ctx) return ctx;
  const { quiz } = ctx;
  const questions = (await db.question.findMany({ where: { quizId: quiz.id }, orderBy: { sortOrder: "asc" } })) as unknown as QuestionRow[];
  const late = !!quiz.timeLimitMin && now.getTime() > attempt.startedAt.getTime() + quiz.timeLimitMin * 60000 + GRACE_SECONDS * 1000;
  const given = late || typeof answers !== "object" || answers === null ? {} : (answers as Record<string, never>);
  const result = gradeQuiz(questions, given, quiz.passPercent);

  // claim the attempt first: two submits at once can not both be graded
  const claimed = await db.quizAttempt.updateMany({
    where: { id: attemptId, submittedAt: null },
    data: { submittedAt: now, score: result.score, maxScore: result.maxScore, percent: result.percent, passed: result.passed, answers: given as never, result: Object.fromEntries(Object.entries(result.perQuestion).map(([k, v]) => [k, { status: v.status, points: v.points, max: v.max }])) },
  });
  if (claimed.count === 0) return { error: "ส่งคำตอบของครั้งนี้ไปแล้ว" };

  const reveal = quiz.showAnswers === "EACH_ATTEMPT" || (quiz.showAnswers === "AFTER_PASS" && result.passed);
  const p = await recomputeProgress(userId, quiz.courseId);
  return { ok: true, outcome: buildOutcome(questions, result, quiz.passPercent, reveal), expired: late, progress: p?.progress ?? 0, complete: !!p?.complete };
}

export { isLessonDone, nextLesson };
