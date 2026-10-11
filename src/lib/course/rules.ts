/**
 * Course progress rules: when is a lesson done, which lessons are open, how far along is the learner.
 * Pure functions over plain facts so they can be unit-tested; the server loads the facts and enforces the answer.
 */
export type LessonRule = "OPEN" | "AFTER_PREVIOUS";
export type BlockKind = "VIDEO" | "LINK" | "MEDIA" | "TEXT" | "QUIZ";

export const DEFAULT_WATCH_PERCENT = 90;

export type BlockFacts = { id: string; kind: BlockKind; required: boolean; minPercent: number | null; quizId: string | null };
export type LessonFacts = { id: string; unlockRule: LessonRule; required: boolean; blocks: BlockFacts[] };

/** What the learner has done so far. */
export type LearnerFacts = {
  /** lesson ids the learner pressed "I have studied this lesson" on */
  confirmed: ReadonlySet<string>;
  /** watched percent per VIDEO block id */
  watch: Readonly<Record<string, number>>;
  /** quiz ids the learner has passed */
  passedQuizzes: ReadonlySet<string>;
};

export const watchTarget = (b: Pick<BlockFacts, "minPercent">) => b.minPercent ?? DEFAULT_WATCH_PERCENT;

/** Is this one required block satisfied? (Blocks that can not be measured need the lesson's "I have studied it" press.) */
export function isBlockSatisfied(lessonId: string, b: BlockFacts, l: LearnerFacts): boolean {
  if (b.kind === "VIDEO") return (l.watch[b.id] ?? 0) >= watchTarget(b);
  if (b.kind === "QUIZ") return !!b.quizId && l.passedQuizzes.has(b.quizId);
  return l.confirmed.has(lessonId);
}

/**
 * A lesson is done when every required block is satisfied. A lesson with no required block at all is done once the
 * learner confirms it. (A lesson with a required video AND a required text needs both the watch and the confirmation.)
 */
export function isLessonDone(lesson: LessonFacts, l: LearnerFacts): boolean {
  const required = lesson.blocks.filter((b) => b.required);
  if (required.length === 0) return l.confirmed.has(lesson.id);
  return required.every((b) => isBlockSatisfied(lesson.id, b, l));
}

/** Does this lesson need the learner to press the confirmation button? */
export function needsConfirm(lesson: LessonFacts): boolean {
  const required = lesson.blocks.filter((b) => b.required);
  return required.length === 0 || required.some((b) => b.kind !== "VIDEO" && b.kind !== "QUIZ");
}

/** `lessons` must be in course order. Lesson i is open when its rule is OPEN, it is first, or the lesson before it is done. */
export function isLessonUnlocked(lessons: LessonFacts[], index: number, done: ReadonlySet<string>): boolean {
  const lesson = lessons[index];
  if (!lesson) return false;
  if (lesson.unlockRule === "OPEN" || index === 0) return true;
  return done.has(lessons[index - 1].id);
}

export function doneLessonIds(lessons: LessonFacts[], l: LearnerFacts): Set<string> {
  return new Set(lessons.filter((x) => isLessonDone(x, l)).map((x) => x.id));
}

/** Share of the REQUIRED lessons that are done (0-100). A course with no required lesson reports 0 and never completes. */
export function courseProgress(lessons: LessonFacts[], done: ReadonlySet<string>): { done: number; total: number; percent: number; complete: boolean } {
  const required = lessons.filter((x) => x.required);
  const d = required.filter((x) => done.has(x.id)).length;
  return { done: d, total: required.length, percent: required.length ? Math.round((d / required.length) * 100) : 0, complete: required.length > 0 && d === required.length };
}

/** Where "continue" should go: the first open lesson that is not done yet (null when everything open is done). */
export function nextLesson(lessons: LessonFacts[], done: ReadonlySet<string>): LessonFacts | null {
  for (let i = 0; i < lessons.length; i++) {
    if (!done.has(lessons[i].id) && isLessonUnlocked(lessons, i, done)) return lessons[i];
  }
  return null;
}
