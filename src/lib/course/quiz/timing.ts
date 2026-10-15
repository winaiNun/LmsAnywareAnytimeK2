/**
 * Time-limit helpers for quizzes: pure functions, no database, usable in the browser.
 * The server decides when an attempt is late (course-learn.ts); these only compute what to show and what to suggest.
 */
import { clozePlaceholders, type QuestionType } from "./schemas";

/** Seconds left of a time-limited attempt, never below 0; null when the quiz has no time limit. The 20 s network grace is NOT included. */
export function remainingSeconds(startedAt: Date, limitMin: number | null, now: Date = new Date()): number | null {
  if (!limitMin) return null;
  return Math.max(0, Math.ceil((startedAt.getTime() + limitMin * 60000 - now.getTime()) / 1000));
}

export type WarnLevel = "none" | "5min" | "1min";

/**
 * When the countdown bar should warn. Short quizzes are not warned at the start: the 5-minute warning only
 * applies to quizzes longer than 10 minutes, the 1-minute warning to quizzes longer than 3 minutes.
 */
export function warnLevel(secondsLeft: number, totalSeconds: number): WarnLevel {
  if (secondsLeft <= 60 && totalSeconds > 180) return "1min";
  if (secondsLeft <= 300 && totalSeconds > 600) return "5min";
  return "none";
}

/** Typical seconds a learner needs per question, by type. A rough guide, not a rule. */
export const SECONDS_PER_TYPE: Record<QuestionType, number> = {
  SINGLE: 45,
  MULTI: 60,
  TRUEFALSE: 25,
  SHORT: 60,
  NUMBER: 75,
  MATCH: 90,
  ORDER: 75,
  CATEGORIZE: 90,
  CLOZE: 30, // plus CLOZE_PER_BLANK for every blank
};
const CLOZE_PER_BLANK = 15;
const COMFORT = 1.5; // slack for reading, slow devices and second thoughts
const MIN_SUGGESTED = 5;
export const MAX_TIME_LIMIT_MIN = 300; // the same ceiling the settings form enforces

export type TimedQuestion = { type: QuestionType; config: unknown };

function seconds(q: TimedQuestion): number {
  if (q.type === "CLOZE") {
    const text = (q.config as { text?: unknown } | null)?.text;
    const blanks = typeof text === "string" ? clozePlaceholders(text).length : 0;
    return SECONDS_PER_TYPE.CLOZE + CLOZE_PER_BLANK * Math.max(1, blanks);
  }
  return SECONDS_PER_TYPE[q.type] ?? 60;
}

/** Suggested time limit in whole minutes (rounded up to a multiple of 5, at least 5); 0 when there are no questions. */
export function suggestTimeLimit(questions: TimedQuestion[]): number {
  if (questions.length === 0) return 0;
  const total = questions.reduce((n, q) => n + seconds(q), 0) * COMFORT;
  const minutes = Math.ceil(total / 60 / 5) * 5;
  return Math.min(MAX_TIME_LIMIT_MIN, Math.max(MIN_SUGGESTED, minutes));
}

export type QuizSettingsLike = {
  passPercent: number;
  maxAttempts: number | null;
  timeLimitMin: number | null;
  showAnswers: "NEVER" | "AFTER_PASS" | "EACH_ATTEMPT";
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
};
export type SettingWarning = { level: "warn" | "info"; text: string };

/** Advice for the settings form. Never blocks saving: the author decides. */
export function quizSettingWarnings(s: QuizSettingsLike, info: { questionCount: number; suggestedMin: number; withoutExplanation: number }): SettingWarning[] {
  const out: SettingWarning[] = [];
  const timed = s.timeLimitMin !== null;

  if (timed && info.suggestedMin > 0 && s.timeLimitMin! < info.suggestedMin * 0.6) {
    out.push({ level: "warn", text: `เวลา ${s.timeLimitMin} นาที น้อยกว่าที่แนะนำ (ประมาณ ${info.suggestedMin} นาที) มาก ผู้เรียนอาจทำไม่ทัน ลองกด “ใช้ค่าที่แนะนำ” หรือลดจำนวนข้อ` });
  }
  if (timed && info.suggestedMin > 0 && s.timeLimitMin! > info.suggestedMin * 3) {
    out.push({ level: "info", text: `เวลา ${s.timeLimitMin} นาที มากกว่าที่แนะนำ (ประมาณ ${info.suggestedMin} นาที) หลายเท่า ถ้าไม่ได้ต้องการจำกัดเวลาจริงๆ ปล่อยช่องว่างไว้จะเหมาะกว่า` });
  }
  if (timed && s.maxAttempts === 1 && s.passPercent >= 90) {
    out.push({ level: "warn", text: "ตั้งทั้ง จับเวลา + ทำได้ครั้งเดียว + เกณฑ์ผ่านสูง ผู้เรียนที่เน็ตหลุดหรือเครื่องช้าอาจไม่มีโอกาสแก้ตัว ควรผ่อนอย่างน้อยหนึ่งข้อ" });
  }
  if (timed && s.passPercent === 100 && s.maxAttempts === null) {
    out.push({ level: "info", text: "แบบที่ต้องถูกทุกข้อและทำซ้ำได้ไม่จำกัด (เช่น คำถามปลดล็อกบทถัดไป) ไม่ควรจับเวลา เพราะเป็นการทบทวนมากกว่าการวัดผล" });
  }
  if (s.showAnswers === "EACH_ATTEMPT" && s.maxAttempts === null && !s.shuffleQuestions && !s.shuffleChoices) {
    out.push({ level: "warn", text: "แสดงเฉลยทุกครั้ง + ทำซ้ำไม่จำกัด + ไม่สลับ ผู้เรียนจะจำเฉลยแล้วทำใหม่ได้เต็ม ควรสลับลำดับ จำกัดจำนวนครั้ง หรือแสดงเฉลยหลังผ่านเท่านั้น" });
  }
  if (s.passPercent < 50) {
    out.push({ level: "info", text: `เกณฑ์ผ่าน ${s.passPercent}% ค่อนข้างต่ำ ผู้เรียนอาจผ่านโดยยังไม่เข้าใจเนื้อหาหลัก (แบบวัดผลมักใช้ 60–80%)` });
  }
  if (info.questionCount > 0 && s.showAnswers !== "NEVER" && info.withoutExplanation > 0) {
    out.push({ level: "info", text: `ยังมี ${info.withoutExplanation} ข้อที่ไม่มีคำอธิบายเฉลย ผู้เรียนจะเห็นแค่เฉลยสั้นๆ การอธิบายว่าทำไมถูก/ผิดช่วยให้เรียนรู้ได้มากขึ้น` });
  }
  return out;
}
