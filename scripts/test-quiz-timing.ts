import assert from "node:assert/strict";
import { SECONDS_PER_TYPE, quizSettingWarnings, remainingSeconds, suggestTimeLimit, warnLevel, type QuizSettingsLike } from "../src/lib/course/quiz/timing";

const t0 = new Date("2026-10-15T10:00:00Z");
const at = (s: number) => new Date(t0.getTime() + s * 1000);

// 1. remaining seconds: no limit, counting down, never negative, rounds up
assert.equal(remainingSeconds(t0, null, at(10)), null);
assert.equal(remainingSeconds(t0, 10, t0), 600);
assert.equal(remainingSeconds(t0, 10, at(100)), 500);
assert.equal(remainingSeconds(t0, 10, at(100.2)), 500); // 499.8 -> 500
assert.equal(remainingSeconds(t0, 10, at(600)), 0);
assert.equal(remainingSeconds(t0, 10, at(9999)), 0);
console.log("ok remainingSeconds");

// 2. warning levels and their edges
assert.equal(warnLevel(301, 1800), "none");
assert.equal(warnLevel(300, 1800), "5min");
assert.equal(warnLevel(61, 1800), "5min");
assert.equal(warnLevel(60, 1800), "1min");
assert.equal(warnLevel(0, 1800), "1min");
// short quizzes are not warned from the first second
assert.equal(warnLevel(300, 600), "none"); // 10 min quiz: no 5-minute warning
assert.equal(warnLevel(60, 600), "1min");
assert.equal(warnLevel(60, 180), "none"); // 3 min quiz: no warning at all
assert.equal(warnLevel(30, 120), "none");
console.log("ok warnLevel");

// 3. suggested time: minimum, rounding, per-type weight, cloze blanks, cap
const single = (n: number) => Array.from({ length: n }, () => ({ type: "SINGLE" as const, config: {} }));
assert.equal(suggestTimeLimit([]), 0);
assert.equal(suggestTimeLimit(single(1)), 5); // never below 5
assert.equal(suggestTimeLimit(single(10)), 15); // 10 x 45 s x 1.5 = 11.25 min -> rounded up to 15
assert.equal(suggestTimeLimit(single(20)) % 5, 0);
assert.ok(suggestTimeLimit(single(20)) > suggestTimeLimit(single(10)));
const tf = Array.from({ length: 10 }, () => ({ type: "TRUEFALSE" as const, config: {} }));
assert.ok(suggestTimeLimit(tf) < suggestTimeLimit(single(10)), "true/false is quicker than multiple choice");
const clozeOne = [{ type: "CLOZE" as const, config: { text: "{{1}} กับ {{2}}" } }];
const clozeFour = [{ type: "CLOZE" as const, config: { text: "{{1}} {{2}} {{3}} {{4}}" } }];
const manyCloze = (q: typeof clozeOne) => Array.from({ length: 12 }, () => q[0]);
assert.ok(suggestTimeLimit(manyCloze(clozeFour)) > suggestTimeLimit(manyCloze(clozeOne)), "more blanks, more time");
assert.doesNotThrow(() => suggestTimeLimit([{ type: "CLOZE", config: null }]));
assert.equal(suggestTimeLimit(single(5000)), 300); // capped at the form's maximum
assert.ok(Object.keys(SECONDS_PER_TYPE).length === 9);
console.log("ok suggestTimeLimit");

// 4. warnings for the settings form
const base: QuizSettingsLike = { passPercent: 70, maxAttempts: 2, timeLimitMin: null, showAnswers: "AFTER_PASS", shuffleQuestions: true, shuffleChoices: true };
const info = { questionCount: 10, suggestedMin: 15, withoutExplanation: 0 };
const w = (patch: Partial<QuizSettingsLike>, i = info) => quizSettingWarnings({ ...base, ...patch }, i);
assert.deepEqual(w({}), []); // sensible settings -> silence
assert.ok(w({ timeLimitMin: 5 }).some((x) => x.level === "warn" && x.text.includes("น้อยกว่าที่แนะนำ")));
assert.ok(!w({ timeLimitMin: 12 }).length); // 12 >= 60% of 15
assert.ok(w({ timeLimitMin: 60 }).some((x) => x.text.includes("มากกว่าที่แนะนำ")));
assert.ok(w({ timeLimitMin: 15, maxAttempts: 1, passPercent: 90 }).some((x) => x.level === "warn" && x.text.includes("ครั้งเดียว")));
assert.ok(w({ timeLimitMin: 15, maxAttempts: null, passPercent: 100 }).some((x) => x.text.includes("ปลดล็อก")));
assert.ok(w({ showAnswers: "EACH_ATTEMPT", maxAttempts: null, shuffleQuestions: false, shuffleChoices: false }).some((x) => x.text.includes("จำเฉลย")));
assert.ok(!w({ showAnswers: "EACH_ATTEMPT", maxAttempts: null }).length); // shuffled -> fine
assert.ok(w({ passPercent: 40 }).some((x) => x.text.includes("ต่ำ")));
assert.ok(w({}, { ...info, withoutExplanation: 4 }).some((x) => x.text.includes("4 ข้อ")));
assert.ok(!w({ showAnswers: "NEVER" }, { ...info, withoutExplanation: 4 }).length); // answers never shown -> no explanation nag
assert.deepEqual(w({ timeLimitMin: 1 }, { questionCount: 0, suggestedMin: 0, withoutExplanation: 0 }), []); // empty quiz: nothing to compare
console.log("ok quizSettingWarnings");
