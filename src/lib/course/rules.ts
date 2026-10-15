/**
 * Course progress rules: when is a lesson done, which lessons are open, how far along is the learner.
 * Pure functions over plain facts so they can be unit-tested; the server loads the facts and enforces the answer.
 */
export type LessonRule = "OPEN" | "AFTER_PREVIOUS";
export type BlockKind = "VIDEO" | "LINK" | "MEDIA" | "TEXT" | "HTML" | "QUIZ";

export type BlockFacts = { id: string; kind: BlockKind; required: boolean; quizId: string | null };
export type LessonFacts = { id: string; unlockRule: LessonRule; required: boolean; blocks: BlockFacts[] };

/** What the learner has done so far. */
export type LearnerFacts = {
  /** lesson ids the learner pressed "I have studied this lesson" on */
  confirmed: ReadonlySet<string>;
  /** quiz ids the learner has passed */
  passedQuizzes: ReadonlySet<string>;
};

/** The "unlock questions" of a lesson: its required quiz blocks. */
const unlockQuizzes = (lesson: LessonFacts) => lesson.blocks.filter((b) => b.kind === "QUIZ" && b.required);

/**
 * How a lesson is finished (watching is not measured):
 * - if the author put a required quiz (an "unlock question") in it, passing every such quiz finishes it;
 * - otherwise the learner presses "I have studied this lesson".
 */
export function isLessonDone(lesson: LessonFacts, l: LearnerFacts): boolean {
  const unlock = unlockQuizzes(lesson);
  if (unlock.length === 0) return l.confirmed.has(lesson.id);
  return unlock.every((b) => !!b.quizId && l.passedQuizzes.has(b.quizId));
}

/** Does this lesson need the learner to press the confirmation button? (Not when an unlock question decides.) */
export function needsConfirm(lesson: LessonFacts): boolean {
  return unlockQuizzes(lesson).length === 0;
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
