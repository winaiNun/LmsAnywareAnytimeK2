/* Run with: npm run test:course  (pure logic of the course system: permissions, rules, the quiz engine) */
import assert from "node:assert/strict";
import { canCreateCourse, canEditCourse, canEnroll, canLearn, canPreviewCourse, canReviewCourse, courseReadiness, courseStatusAfterSave, type CourseActor } from "../src/lib/course/access";
import { courseProgress, doneLessonIds, isLessonDone, isLessonUnlocked, needsConfirm, nextLesson, type LearnerFacts, type LessonFacts } from "../src/lib/course/rules";
import { cleanBlock, parseVideoLink, youtubeStart, youtubeVideoId } from "../src/lib/course/blocks";
import { gradeQuestion, gradeQuiz, type QuestionRow } from "../src/lib/course/quiz/grade";
import { emptyState, stateFromQuestion, stateToQuestion, syncBlanks, type EditorState } from "../src/lib/course/quiz/editor-model";
import { normaliseText, parseNumber } from "../src/lib/course/quiz/normalise";
import { presentQuestion, presentQuiz, seededRandom } from "../src/lib/course/quiz/present";
import { clozePlaceholders, parseQuestion } from "../src/lib/course/quiz/schemas";

let passed = 0;
const t = (name: string, fn: () => void) => {
  try { fn(); passed++; } catch (e) { console.error(`x ${name}\n  ${(e as Error).message}`); process.exitCode = 1; }
};

// ---------------------------------------------------------------- permissions
const admin: CourseActor = { id: "a", role: "ADMIN", reviewerAreaIds: [] };
const teacher: CourseActor = { id: "t", role: "TEACHER", creatorStatus: "APPROVED", reviewerAreaIds: [] };
const other: CourseActor = { id: "o", role: "STUDENT", creatorStatus: "NONE", reviewerAreaIds: [] };
const reviewerMath: CourseActor = { id: "r", role: "STUDENT", reviewerAreaIds: ["math"] };
const course = (status: any, by = "t", area = "math") => ({ createdById: by, areaId: area, status });

t("who may create / edit", () => {
  assert.equal(canCreateCourse(admin), true);
  assert.equal(canCreateCourse(teacher), true);
  assert.equal(canCreateCourse({ role: "STUDENT", creatorStatus: "APPROVED" }), true);
  assert.equal(canCreateCourse({ role: "STUDENT", creatorStatus: "PENDING" }), false);
  assert.equal(canCreateCourse(other), false);
  assert.equal(canEditCourse(teacher, course("DRAFT")), true);
  assert.equal(canEditCourse(admin, course("DRAFT")), true);
  assert.equal(canEditCourse(other, course("DRAFT")), false);
  assert.equal(canEditCourse(reviewerMath, course("PENDING")), false);
});

t("review: reviewer of the area, never of their own course", () => {
  assert.equal(canReviewCourse(admin, course("PENDING")), true);
  assert.equal(canReviewCourse(reviewerMath, course("PENDING")), true);
  assert.equal(canReviewCourse(reviewerMath, course("PENDING", "r")), false);
  assert.equal(canReviewCourse({ ...reviewerMath, reviewerAreaIds: ["thai"] }, course("PENDING")), false);
  assert.equal(canReviewCourse(teacher, course("PENDING")), false);
});

t("preview of courses that are not public", () => {
  assert.equal(canPreviewCourse(null, course("PUBLISHED")), true);
  assert.equal(canPreviewCourse(null, course("DRAFT")), false);
  assert.equal(canPreviewCourse(other, course("PENDING")), false);
  assert.equal(canPreviewCourse(teacher, course("DRAFT")), true);
  assert.equal(canPreviewCourse(reviewerMath, course("PENDING", "r")), true, "a reviewer may look at their own area's courses");
  assert.equal(canPreviewCourse({ ...reviewerMath, reviewerAreaIds: ["thai"] }, course("PENDING")), false);
});

t("status after saving", () => {
  assert.equal(courseStatusAfterSave(admin, null, false), "DRAFT");
  assert.equal(courseStatusAfterSave(admin, null, true), "PUBLISHED");
  assert.equal(courseStatusAfterSave(admin, "PUBLISHED", false), "PUBLISHED");
  assert.equal(courseStatusAfterSave(teacher, null, true), "PENDING");
  assert.equal(courseStatusAfterSave(teacher, "DRAFT", false), "DRAFT");
  assert.equal(courseStatusAfterSave(teacher, "REJECTED", false), "DRAFT");
  assert.equal(courseStatusAfterSave(teacher, "PUBLISHED", false), "PENDING", "editing live content sends it back to the queue");
  assert.equal(courseStatusAfterSave(teacher, "PENDING", false), "PENDING");
});

t("enrol and learn", () => {
  assert.equal(canEnroll({ status: "PUBLISHED", enrollOpen: true }), true);
  assert.equal(canEnroll({ status: "PUBLISHED", enrollOpen: false }), false);
  assert.equal(canEnroll({ status: "PENDING", enrollOpen: true }), false);
  assert.deepEqual(canLearn(null, course("PUBLISHED"), false), { ok: false, reason: "login" });
  assert.deepEqual(canLearn(other, course("PUBLISHED"), false), { ok: false, reason: "enroll" });
  assert.deepEqual(canLearn(other, course("PUBLISHED"), true), { ok: true, preview: false });
  assert.deepEqual(canLearn(other, course("PENDING"), true), { ok: false, reason: "unavailable" }, "a course under re-review is closed even for enrolled learners");
  assert.deepEqual(canLearn(teacher, course("DRAFT"), false), { ok: true, preview: true });
  assert.deepEqual(canLearn(teacher, course("PUBLISHED"), false), { ok: true, preview: true }, "authors open their own live course without enrolling");
});

t("readiness list for review", () => {
  const ok = { title: "คอร์สทดสอบ", description: "คำอธิบายคอร์สที่ยาวพอ", hasCover: true, lessons: [{ title: "บท 1", blockCount: 2 }], quizzes: [{ title: "แบบทดสอบ 1", questionCount: 3, invalidQuestions: 0 }] };
  assert.deepEqual(courseReadiness(ok), []);
  assert.ok(courseReadiness({ ...ok, hasCover: false }).some((m) => m.includes("ปก")));
  assert.ok(courseReadiness({ ...ok, lessons: [] }).some((m) => m.includes("บทเรียนอย่างน้อย 1")));
  assert.ok(courseReadiness({ ...ok, lessons: [{ title: "บท 1", blockCount: 0 }] }).some((m) => m.includes("ยังไม่มีเนื้อหา")));
  assert.ok(courseReadiness({ ...ok, quizzes: [{ title: "Q", questionCount: 0, invalidQuestions: 0 }] }).some((m) => m.includes("ยังไม่มีคำถาม")));
  assert.ok(courseReadiness({ ...ok, quizzes: [{ title: "Q", questionCount: 2, invalidQuestions: 1 }] }).some((m) => m.includes("เฉลยไม่ครบ")));
});

// ---------------------------------------------------------------- lesson rules
const video = (id: string, req = false) => ({ id, kind: "VIDEO" as const, required: req, quizId: null });
const quizBlock = (id: string, quizId: string, req = true) => ({ id, kind: "QUIZ" as const, required: req, quizId });
const textBlock = (id: string, req = true) => ({ id, kind: "TEXT" as const, required: req, quizId: null });
const lesson = (id: string, blocks: LessonFacts["blocks"], rule: LessonFacts["unlockRule"] = "AFTER_PREVIOUS", required = true): LessonFacts => ({ id, unlockRule: rule, required, blocks });
const facts = (p: Partial<{ confirmed: string[]; passed: string[] }> = {}): LearnerFacts => ({ confirmed: new Set(p.confirmed ?? []), passedQuizzes: new Set(p.passed ?? []) });

t("a lesson is done by the confirmation, or by its unlock question when it has one", () => {
  // no unlock question: the "I have studied this lesson" press decides, whatever the blocks are
  for (const blocks of [[], [video("v")], [video("v"), textBlock("x", true)]]) {
    assert.equal(isLessonDone(lesson("L", blocks), facts()), false);
    assert.equal(isLessonDone(lesson("L", blocks), facts({ confirmed: ["L"] })), true);
  }
  // with a required quiz: passing it is enough, pressing the button is not
  const l = lesson("L1", [video("v"), quizBlock("q", "Q1", true)]);
  assert.equal(isLessonDone(l, facts()), false);
  assert.equal(isLessonDone(l, facts({ confirmed: ["L1"] })), false, "the button does not replace the unlock question");
  assert.equal(isLessonDone(l, facts({ passed: ["Q2"] })), false);
  assert.equal(isLessonDone(l, facts({ passed: ["Q1"] })), true);
  assert.equal(isLessonDone(lesson("L", [quizBlock("q", "Q1", false)]), facts({ passed: ["Q1"] })), false, "an optional quiz does not finish a lesson");
  const two = lesson("L2", [quizBlock("a", "QA"), quizBlock("b", "QB")]);
  assert.equal(isLessonDone(two, facts({ passed: ["QA"] })), false, "every unlock question must be passed");
  assert.equal(isLessonDone(two, facts({ passed: ["QA", "QB"] })), true);
});

t("which lessons show a confirmation button", () => {
  assert.equal(needsConfirm(lesson("L", [video("v")])), true);
  assert.equal(needsConfirm(lesson("L", [textBlock("x", true)])), true);
  assert.equal(needsConfirm(lesson("L", [])), true);
  assert.equal(needsConfirm(lesson("L", [quizBlock("q", "Q", false)])), true);
  assert.equal(needsConfirm(lesson("L", [video("v"), quizBlock("q", "Q", true)])), false, "the unlock question decides");
});

t("unlock order and progress", () => {
  const ls = [lesson("A", [textBlock("a")], "OPEN"), lesson("B", [textBlock("b")]), lesson("C", [textBlock("c")]), lesson("D", [textBlock("d")], "OPEN"), lesson("E", [textBlock("e")], "AFTER_PREVIOUS", false)];
  const none = doneLessonIds(ls, facts());
  assert.deepEqual(ls.map((_, i) => isLessonUnlocked(ls, i, none)), [true, false, false, true, false]);
  const a = doneLessonIds(ls, facts({ confirmed: ["A"] }));
  assert.deepEqual(ls.map((_, i) => isLessonUnlocked(ls, i, a)), [true, true, false, true, false]);
  assert.equal(nextLesson(ls, a)?.id, "B");
  const all = doneLessonIds(ls, facts({ confirmed: ["A", "B", "C", "D"] }));
  assert.deepEqual(courseProgress(ls, all), { done: 4, total: 4, percent: 100, complete: true }, "the optional lesson E does not count");
  assert.deepEqual(courseProgress(ls, a), { done: 1, total: 4, percent: 25, complete: false });
  assert.deepEqual(courseProgress([], new Set()), { done: 0, total: 0, percent: 0, complete: false });
  assert.equal(isLessonUnlocked(ls, 9, none), false);
});

// ---------------------------------------------------------------- text normalising
t("normalise: Thai digits, zero-width, spaces, case", () => {
  assert.equal(normaliseText("  ๑๒๓  "), "123");
  assert.equal(normaliseText("ก​ข"), "กข");
  assert.equal(normaliseText("Hello   World"), "hello world");
  assert.equal(normaliseText("Hello", { caseSensitive: true }), "Hello");
  assert.equal(normaliseText("a b c", { ignoreSpaces: true }), "abc");
  assert.equal(parseNumber("๑,๒๕๐.๕"), 1250.5);
  assert.equal(parseNumber(" -3 "), -3);
  assert.equal(parseNumber("−3"), -3);
  assert.equal(parseNumber(".5"), 0.5);
  for (const bad of ["", "abc", "1.2.3", "1e5", "--2", "12abc", "∞"]) assert.equal(parseNumber(bad), null, bad);
});

// ---------------------------------------------------------------- grading, one question per type
const q = (type: any, config: any, answerKey: any, points = 4): QuestionRow => ({ id: `q-${type}`, type, points, prompt: "คำถาม", imageUrl: null, explanation: "เพราะว่า...", sortOrder: 0, config, answerKey });
const A = (v: object) => v as any;

t("grade SINGLE / TRUEFALSE", () => {
  const s = q("SINGLE", { choices: [{ id: "a", text: "ก" }, { id: "b", text: "ข" }] }, { correctId: "b" });
  assert.equal(gradeQuestion(s, A({ choiceId: "b" })).status, "correct");
  assert.equal(gradeQuestion(s, A({ choiceId: "a" })).status, "wrong");
  assert.equal(gradeQuestion(s, A({})).status, "blank");
  assert.equal(gradeQuestion(s, undefined).status, "blank");
  assert.equal(gradeQuestion(s, A({ choiceId: 5 })).status, "blank", "wrong shape counts as no answer");
  assert.equal(gradeQuestion(s, "b" as any).status, "blank");
  const tf = q("TRUEFALSE", {}, { value: false });
  assert.equal(gradeQuestion(tf, A({ value: false })).points, 4);
  assert.equal(gradeQuestion(tf, A({ value: true })).points, 0);
  assert.equal(gradeQuestion(tf, A({ value: "false" })).status, "blank");
});

t("grade MULTI (all-or-nothing and partial)", () => {
  const choices = [{ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "3" }, { id: "d", text: "4" }];
  const all = q("MULTI", { choices, scoring: "all" }, { correctIds: ["a", "b"] });
  assert.equal(gradeQuestion(all, A({ choiceIds: ["b", "a"] })).status, "correct");
  assert.equal(gradeQuestion(all, A({ choiceIds: ["a"] })).status, "wrong");
  assert.equal(gradeQuestion(all, A({ choiceIds: ["a", "b", "c"] })).status, "wrong");
  assert.equal(gradeQuestion(all, A({ choiceIds: [] })).status, "blank");
  assert.equal(gradeQuestion(all, A({ choiceIds: ["zzz"] })).status, "blank", "unknown ids are ignored");
  const part = q("MULTI", { choices, scoring: "partial" }, { correctIds: ["a", "b"] });
  assert.equal(gradeQuestion(part, A({ choiceIds: ["a"] })).points, 2);
  assert.equal(gradeQuestion(part, A({ choiceIds: ["a", "c"] })).points, 0, "a wrong pick cancels a right one");
  assert.equal(gradeQuestion(part, A({ choiceIds: ["c", "d"] })).points, 0, "never negative");
  assert.equal(gradeQuestion(part, A({ choiceIds: ["a", "b", "a"] })).status, "correct", "duplicates do not matter");
});

t("grade SHORT (Thai text) and NUMBER", () => {
  const s = q("SHORT", {}, { accepted: ["กรุงเทพมหานคร", "กรุงเทพ"], ignoreSpaces: true, caseSensitive: false });
  assert.equal(gradeQuestion(s, A({ text: " กรุงเทพ " })).status, "correct");
  assert.equal(gradeQuestion(s, A({ text: "กรุง เทพ มหานคร" })).status, "correct");
  assert.equal(gradeQuestion(s, A({ text: "เชียงใหม่" })).status, "wrong");
  assert.equal(gradeQuestion(s, A({ text: "   " })).status, "blank");
  const en = q("SHORT", {}, { accepted: ["Photosynthesis"], ignoreSpaces: true, caseSensitive: false });
  assert.equal(gradeQuestion(en, A({ text: "photosynthesis" })).status, "correct");
  const cs = q("SHORT", {}, { accepted: ["H2O"], ignoreSpaces: true, caseSensitive: true });
  assert.equal(gradeQuestion(cs, A({ text: "h2o" })).status, "wrong");
  assert.equal(gradeQuestion(cs, A({ text: "H๒O" })).status, "correct", "Thai digit equals Arabic digit");
  const n = q("NUMBER", {}, { value: 12.5, tolerance: 0.1 });
  assert.equal(gradeQuestion(n, A({ text: "๑๒.๕" })).status, "correct");
  assert.equal(gradeQuestion(n, A({ text: "12.55" })).status, "correct");
  assert.equal(gradeQuestion(n, A({ text: "12.7" })).status, "wrong");
  assert.equal(gradeQuestion(n, A({ text: "สิบสอง" })).status, "wrong", "not a number: wrong, not blank");
  assert.equal(gradeQuestion(n, A({ text: "" })).status, "blank");
  assert.equal(gradeQuestion(n, A({ text: 12.5 })).status, "correct", "a number value is accepted too");
  assert.equal(gradeQuestion(q("NUMBER", {}, { value: 1000, tolerance: 0 }), A({ text: "1,000" })).status, "correct");
});

t("grade MATCH / ORDER / CATEGORIZE with partial credit", () => {
  const m = q("MATCH", { left: [{ id: "l1", text: "ก" }, { id: "l2", text: "ข" }, { id: "l3", text: "ค" }, { id: "l4", text: "ง" }], right: [{ id: "r1", text: "1" }, { id: "r2", text: "2" }, { id: "r3", text: "3" }, { id: "r4", text: "4" }, { id: "r5", text: "x" }] }, { pairs: { l1: "r1", l2: "r2", l3: "r3", l4: "r4" } });
  assert.equal(gradeQuestion(m, A({ pairs: { l1: "r1", l2: "r2", l3: "r3", l4: "r4" } })).status, "correct");
  assert.equal(gradeQuestion(m, A({ pairs: { l1: "r1", l2: "r2" } })).points, 2, "half right, rest unanswered");
  assert.equal(gradeQuestion(m, A({ pairs: { l1: "r2", l2: "r1" } })).points, 0);
  assert.equal(gradeQuestion(m, A({ pairs: {} })).status, "blank");
  assert.equal(gradeQuestion(m, A({ pairs: { zzz: "r1" } })).status, "blank");
  const o = q("ORDER", { items: [{ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "3" }, { id: "d", text: "4" }] }, { order: ["a", "b", "c", "d"] });
  assert.equal(gradeQuestion(o, A({ order: ["a", "b", "c", "d"] })).status, "correct");
  assert.equal(gradeQuestion(o, A({ order: ["a", "b", "d", "c"] })).points, 2);
  assert.equal(gradeQuestion(o, A({ order: ["b", "a", "d", "c"] })).points, 0);
  assert.equal(gradeQuestion(o, A({ order: ["a", "a", "a", "a"] })).points, 1, "repeating an item gains nothing");
  assert.equal(gradeQuestion(o, A({ order: [] })).status, "blank");
  const c = q("CATEGORIZE", { categories: [{ id: "x", text: "X" }, { id: "y", text: "Y" }], items: [{ id: "1", text: "a" }, { id: "2", text: "b" }, { id: "3", text: "c" }, { id: "4", text: "d" }] }, { map: { 1: "x", 2: "x", 3: "y", 4: "y" } });
  assert.equal(gradeQuestion(c, A({ map: { 1: "x", 2: "x", 3: "y", 4: "y" } })).status, "correct");
  assert.equal(gradeQuestion(c, A({ map: { 1: "x", 2: "y", 3: "y", 4: "x" } })).points, 2);
  assert.equal(gradeQuestion(c, A({ map: { 1: "x" } })).points, 1);
  assert.equal(gradeQuestion(c, A({})).status, "blank");
});

t("grade CLOZE (typed and chosen blanks)", () => {
  const z = q("CLOZE", { text: "เมืองหลวงคือ {{1}} อยู่ภูมิภาค {{2}}", blanks: [{ id: "1", mode: "type" }, { id: "2", mode: "choose", options: [{ id: "o1", text: "กลาง" }, { id: "o2", text: "เหนือ" }] }] }, { blanks: { 1: { accepted: ["กรุงเทพ", "กรุงเทพมหานคร"] }, 2: { correctOptionId: "o1" } } });
  assert.equal(gradeQuestion(z, A({ blanks: { 1: "กรุงเทพ", 2: "o1" } })).status, "correct");
  assert.equal(gradeQuestion(z, A({ blanks: { 1: "กรุง เทพ", 2: "o2" } })).points, 2);
  assert.equal(gradeQuestion(z, A({ blanks: { 1: "", 2: "o1" } })).points, 2);
  assert.equal(gradeQuestion(z, A({ blanks: { 1: "x", 2: "o2" } })).status, "wrong");
  assert.equal(gradeQuestion(z, A({ blanks: { 1: "", 2: "" } })).status, "blank");
});

t("quiz total, pass mark and rounding", () => {
  const qs = [
    { ...q("TRUEFALSE", {}, { value: true }, 1), id: "a" },
    { ...q("TRUEFALSE", {}, { value: true }, 1), id: "b" },
    { ...q("MULTI", { choices: [{ id: "x", text: "1" }, { id: "y", text: "2" }, { id: "z", text: "3" }], scoring: "partial" }, { correctIds: ["x", "y", "z"] }, 1), id: "c" },
  ];
  const r = gradeQuiz(qs, { a: { value: true }, b: { value: false }, c: { choiceIds: ["x"] } }, 50);
  assert.equal(r.maxScore, 3);
  assert.equal(r.score, 1.33);
  assert.equal(r.percent, 44);
  assert.equal(r.passed, false);
  assert.equal(gradeQuiz(qs, { a: { value: true }, b: { value: true }, c: { choiceIds: ["x", "y", "z"] } }, 100).passed, true);
  assert.equal(gradeQuiz([], {}, 0).passed, false, "an empty quiz can not be passed");
  assert.equal(gradeQuiz(qs, {}, 0).percent, 0);
});

// ---------------------------------------------------------------- presenting questions without the key
t("the learner copy never contains the answer key", () => {
  const rows: QuestionRow[] = [
    { ...q("SINGLE", { choices: [{ id: "a", text: "ก" }, { id: "b", text: "ข" }, { id: "c", text: "ค" }] }, { correctId: "SECRET-single" }), id: "s1", sortOrder: 1 },
    { ...q("SHORT", { placeholder: "พิมพ์" }, { accepted: ["SECRET-short"], ignoreSpaces: true, caseSensitive: false }), id: "s2", sortOrder: 2 },
    { ...q("NUMBER", {}, { value: 987654.321, tolerance: 0 }), id: "s3", sortOrder: 3 },
    { ...q("CLOZE", { text: "{{1}}", blanks: [{ id: "1", mode: "type" }] }, { blanks: { 1: { accepted: ["SECRET-cloze"] } } }), id: "s4", sortOrder: 4 },
    { ...q("MATCH", { left: [{ id: "l1", text: "ก" }, { id: "l2", text: "ข" }], right: [{ id: "r1", text: "1" }, { id: "r2", text: "2" }] }, { pairs: { l1: "r2", l2: "r1" } }), id: "s5", sortOrder: 5, explanation: "SECRET-explanation" },
  ];
  const json = JSON.stringify(presentQuiz(rows, { seed: 42, shuffleQuestions: true, shuffleChoices: true }));
  for (const secret of ["SECRET-single", "SECRET-short", "987654", "SECRET-cloze", "SECRET-explanation", "answerKey", "correctId", "correctIds", "accepted", "correctOptionId", "pairs"]) assert.equal(json.includes(secret), false, secret);
});

t("seeded order: same seed same order, other seeds differ, nothing is lost", () => {
  const choices = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, text: String(i) }));
  const sq = q("SINGLE", { choices }, { correctId: "c0" });
  const a = presentQuestion(sq, 1234, true).config.choices.map((c: any) => c.id);
  assert.deepEqual(presentQuestion(sq, 1234, true).config.choices.map((c: any) => c.id), a, "stable");
  assert.notDeepEqual(a, choices.map((c) => c.id));
  assert.ok([1, 2, 3, 4, 5, 6].some((s) => presentQuestion(sq, s, true).config.choices.map((c: any) => c.id).join() !== a.join()));
  assert.deepEqual([...a].sort(), choices.map((c) => c.id).sort());
  assert.deepEqual(presentQuestion(sq, 1234, false).config.choices, choices, "choices keep the author's order when shuffling is off");
  const r = seededRandom(7);
  const xs = Array.from({ length: 1000 }, () => r());
  assert.ok(xs.every((x) => x >= 0 && x < 1) && new Set(xs).size > 990);
  const rows = Array.from({ length: 10 }, (_, i) => ({ ...sq, id: `q${i}`, sortOrder: i }));
  assert.deepEqual(presentQuiz(rows, { seed: 5, shuffleQuestions: false, shuffleChoices: false }).map((x) => x.id), rows.map((x) => x.id));
  const sh = presentQuiz(rows, { seed: 5, shuffleQuestions: true, shuffleChoices: false }).map((x) => x.id);
  assert.deepEqual([...sh].sort(), rows.map((x) => x.id).sort());
  assert.notDeepEqual(sh, rows.map((x) => x.id));
  // an ORDER question is never shown already in the right order, and MATCH rights are always mixed up
  const ord = q("ORDER", { items: [{ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "3" }] }, { order: ["a", "b", "c"] });
  for (let seed = 1; seed < 40; seed++) assert.notDeepEqual(presentQuestion(ord, seed, true).config.items.map((i: any) => i.id), ["a", "b", "c"]);
});

// ---------------------------------------------------------------- the editor's validation
t("parseQuestion: valid questions of every type", () => {
  const good: [string, any, any][] = [
    ["SINGLE", { choices: [{ id: "a", text: "ก" }, { id: "b", text: "ข" }] }, { correctId: "a" }],
    ["MULTI", { choices: [{ id: "a", text: "ก" }, { id: "b", text: "ข" }], scoring: "partial" }, { correctIds: ["a"] }],
    ["TRUEFALSE", {}, { value: true }],
    ["SHORT", {}, { accepted: ["คำตอบ"] }],
    ["NUMBER", {}, { value: 3.14, tolerance: 0.01 }],
    ["MATCH", { left: [{ id: "l1", text: "ก" }, { id: "l2", text: "ข" }], right: [{ id: "r1", text: "1" }, { id: "r2", text: "2" }, { id: "r3", text: "ตัวลวง" }] }, { pairs: { l1: "r1", l2: "r2" } }],
    ["ORDER", { items: [{ id: "a", text: "1" }, { id: "b", text: "2" }] }, { order: ["b", "a"] }],
    ["CATEGORIZE", { categories: [{ id: "x", text: "X" }, { id: "y", text: "Y" }], items: [{ id: "1", text: "a" }, { id: "2", text: "b" }] }, { map: { 1: "x", 2: "y" } }],
    ["CLOZE", { text: "{{1}} และ {{2}}", blanks: [{ id: "1", mode: "type" }, { id: "2", mode: "choose", options: [{ id: "o1", text: "ก" }, { id: "o2", text: "ข" }] }] }, { blanks: { 1: { accepted: ["ก"] }, 2: { correctOptionId: "o2" } } }],
  ];
  for (const [type, cfg, key] of good) {
    const r = parseQuestion(type, cfg, key);
    assert.equal(r.ok, true, `${type}: ${r.ok ? "" : r.error}`);
  }
});

t("parseQuestion: broken questions are refused with a Thai reason", () => {
  const bad: [string, any, any, string][] = [
    ["SINGLE", { choices: [{ id: "a", text: "ก" }] }, { correctId: "a" }, "อย่างน้อย 2"],
    ["SINGLE", { choices: [{ id: "a", text: "ก" }, { id: "b", text: "ข" }] }, { correctId: "zzz" }, "หนึ่งในตัวเลือก"],
    ["SINGLE", { choices: [{ id: "a", text: "ก" }, { id: "a", text: "ข" }] }, { correctId: "a" }, "ซ้ำ"],
    ["SINGLE", { choices: [{ id: "a", text: "" }, { id: "b", text: "ข" }] }, { correctId: "a" }, "กรอกข้อความ"],
    ["MULTI", { choices: [{ id: "a", text: "ก" }, { id: "b", text: "ข" }] }, { correctIds: [] }, "อย่างน้อย 1"],
    ["TRUEFALSE", {}, {}, "ถูกหรือผิด"],
    ["SHORT", {}, { accepted: [] }, "อย่างน้อย 1"],
    ["NUMBER", {}, { value: "x" }, "เฉลย"],
    ["MATCH", { left: [{ id: "l1", text: "ก" }, { id: "l2", text: "ข" }], right: [{ id: "r1", text: "1" }, { id: "r2", text: "2" }] }, { pairs: { l1: "r1" } }, "ให้ครบ"],
    ["MATCH", { left: [{ id: "l1", text: "ก" }, { id: "l2", text: "ข" }], right: [{ id: "r1", text: "1" }, { id: "r2", text: "2" }] }, { pairs: { l1: "r1", l2: "r1" } }, "เพียงข้อเดียว"],
    ["ORDER", { items: [{ id: "a", text: "1" }, { id: "b", text: "2" }] }, { order: ["a"] }, "ครบทุกรายการ"],
    ["CATEGORIZE", { categories: [{ id: "x", text: "X" }, { id: "y", text: "Y" }], items: [{ id: "1", text: "a" }, { id: "2", text: "b" }] }, { map: { 1: "x" } }, "ให้ครบ"],
    ["CLOZE", { text: "ไม่มีช่อง", blanks: [{ id: "1", mode: "type" }] }, { blanks: { 1: { accepted: ["ก"] } } }, "ช่องว่าง"],
    ["CLOZE", { text: "{{1}}", blanks: [{ id: "1", mode: "choose", options: [{ id: "o1", text: "ก" }, { id: "o2", text: "ข" }] }] }, { blanks: { 1: { correctOptionId: "zzz" } } }, "คำตอบที่ถูก"],
    ["CLOZE", { text: "{{1}}", blanks: [{ id: "1", mode: "type" }] }, { blanks: {} }, "เฉลย"],
    ["NOPE", {}, {}, "ชนิด"],
  ];
  for (const [type, cfg, key, hint] of bad) {
    const r = parseQuestion(type, cfg, key);
    assert.equal(r.ok, false, `${type} should fail (${hint})`);
    if (!r.ok) assert.ok(r.error.includes(hint), `${type}: "${r.error}" should mention "${hint}"`);
  }
  assert.deepEqual(clozePlaceholders("ก {{1}} ข {{ 2 }} ค {{x_y}}"), ["1", "2", "x_y"]);
});

// ---------------------------------------------------------------- lesson blocks
t("YouTube links: id, start time, only single videos", () => {
  for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share"]) {
    const r = parseVideoLink(u);
    assert.ok(r.ok, u);
    if (r.ok) assert.equal(r.videoId, "dQw4w9WgXcQ");
  }
  assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s"), "dQw4w9WgXcQ");
  assert.equal(youtubeStart("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s"), 90);
  assert.equal(youtubeStart("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), 0);
  for (const bad of ["https://www.youtube.com/playlist?list=PLabc123456789", "https://vimeo.com/1", "https://evilyoutube.com/watch?v=dQw4w9WgXcQ", "not a link", "https://www.youtube.com/watch?v=short"]) assert.equal(parseVideoLink(bad).ok, false, bad);
  assert.equal(youtubeVideoId(null), null);
  assert.equal(youtubeVideoId("https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ"), null);
});

t("block input is cleaned per kind", () => {
  const v = cleanBlock({ kind: "VIDEO", url: "youtu.be/dQw4w9WgXcQ", label: "  คลิป  ", required: true });
  assert.ok(v.ok && v.block.url === "https://www.youtube.com/watch?v=dQw4w9WgXcQ" && v.block.label === "คลิป" && v.block.required === false, "only a quiz can be required");
  assert.ok(cleanBlock({ kind: "LINK", url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view" }).ok);
  for (const bad of ["javascript:alert(1)", "http://example.com", "https://localhost/x", "ftp://x.org", ""]) assert.equal(cleanBlock({ kind: "LINK", url: bad }).ok, false, bad);
  assert.equal(cleanBlock({ kind: "TEXT", text: "  " }).ok, false);
  assert.equal(cleanBlock({ kind: "TEXT", text: "ก".repeat(20001) }).ok, false);
  assert.ok(cleanBlock({ kind: "TEXT", text: "สวัสดี" }).ok);
  assert.equal(cleanBlock({ kind: "MEDIA" }).ok, false);
  assert.equal(cleanBlock({ kind: "QUIZ" }).ok, false);
  const q = cleanBlock({ kind: "QUIZ", quizId: "z1", required: true });
  assert.ok(q.ok && q.block.quizId === "z1" && q.block.required);
  assert.equal(cleanBlock({ kind: "NOPE" as never }).ok, false);
});

// ---------------------------------------------------------------- editor model
t("editor model: every type converts to valid JSON and back", () => {
  const filled: EditorState[] = [
    { type: "SINGLE", choices: [{ id: "c1", text: "ก" }, { id: "c2", text: "ข" }, { id: "c3", text: "ค" }], correct: "c2" },
    { type: "MULTI", choices: [{ id: "c1", text: "ก" }, { id: "c2", text: "ข" }, { id: "c3", text: "ค" }], correct: ["c1", "c3"], scoring: "partial" },
    { type: "TRUEFALSE", value: false },
    { type: "SHORT", accepted: "กรุงเทพ\nกรุงเทพมหานคร\n", ignoreSpaces: true, caseSensitive: false, placeholder: "พิมพ์ชื่อ" },
    { type: "NUMBER", value: "1,250.5", tolerance: "0.5", unit: "บาท" },
    { type: "MATCH", rows: [{ id: "a", left: "ก", right: "1" }, { id: "b", left: "ข", right: "2" }], distractors: "ตัวลวง 1\nตัวลวง 2" },
    { type: "ORDER", items: [{ id: "x", text: "หนึ่ง" }, { id: "y", text: "สอง" }, { id: "z", text: "สาม" }] },
    { type: "CATEGORIZE", categories: [{ id: "k1", text: "สัตว์" }, { id: "k2", text: "พืช" }], items: [{ id: "i1", text: "แมว", categoryId: "k1" }, { id: "i2", text: "มะม่วง", categoryId: "k2" }, { id: "i3", text: "ช้าง", categoryId: "k1" }] },
    syncBlanks({ type: "CLOZE", text: "เมืองหลวงคือ {{1}} อยู่ภาค {{2}}", blanks: [] }),
  ];
  for (const st of filled) {
    let state: EditorState = st;
    if (state.type === "CLOZE") {
      state = { ...state, blanks: [{ id: "1", mode: "type", accepted: "กรุงเทพ", options: "", correct: 0 }, { id: "2", mode: "choose", accepted: "", options: "เหนือ\nกลาง\nใต้", correct: 1 }] };
    }
    const q = stateToQuestion(state);
    const parsed = parseQuestion(state.type, q.config, q.answerKey);
    assert.equal(parsed.ok, true, `${state.type}: ${parsed.ok ? "" : parsed.error}`);
    // reopening the saved question gives an editor state that saves to the same JSON
    const back = stateFromQuestion(state.type, q.config, q.answerKey);
    assert.deepEqual(stateToQuestion(back), q, `${state.type} round trip`);
  }
  // the converted MATCH keeps the right pairing and the distractors
  const m = stateToQuestion(filled[5]);
  assert.equal(m.config.right.length, 4);
  assert.deepEqual(m.answerKey.pairs, { l1: "r1", l2: "r2" });
  // a number with a thousands comma
  assert.equal(stateToQuestion(filled[4]).answerKey.value, 1250.5);
});

t("editor model: empty forms convert but do not pass validation; blanks follow the marks", () => {
  for (const type of ["SINGLE", "MULTI", "TRUEFALSE", "SHORT", "NUMBER", "MATCH", "ORDER", "CATEGORIZE", "CLOZE"] as const) {
    const q = stateToQuestion(emptyState(type));
    assert.equal(parseQuestion(type, q.config, q.answerKey).ok, false, `${type} empty must not be valid`);
  }
  let c = syncBlanks({ type: "CLOZE", text: "{{1}} กับ {{2}}", blanks: [] });
  assert.deepEqual(c.blanks.map((b) => b.id), ["1", "2"]);
  c = { ...c, blanks: c.blanks.map((b) => (b.id === "2" ? { ...b, accepted: "คำตอบ" } : b)) };
  c = syncBlanks({ ...c, text: "{{2}} และ {{3}}" });
  assert.deepEqual(c.blanks.map((b) => b.id), ["2", "3"]);
  assert.equal(c.blanks[0].accepted, "คำตอบ", "an existing blank keeps what was typed");
  assert.deepEqual(syncBlanks({ ...c, text: "ไม่มีช่อง" }).blanks, []);
});

console.log(`course logic: ${passed} groups passed`);
