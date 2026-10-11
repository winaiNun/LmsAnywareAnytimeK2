/* eslint-disable @typescript-eslint/no-explicit-any -- reads the per-type JSON validated by schemas.ts */
/**
 * What the learner is told after handing in: the score, and (when the quiz allows it) the correct answer in words plus
 * the author's explanation. The answer key itself is turned into text on the server, so the browser never gets raw keys.
 */
import type { GradeResult, QuestionRow, QuizResult } from "./grade";

export type QuestionOutcome = { status: GradeResult["status"]; points: number; max: number; reveal?: { answer: string; explanation: string } };
export type QuizOutcome = {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  passPercent: number;
  perQuestion: Record<string, QuestionOutcome>;
};

/** The correct answer as one readable Thai line. */
export function describeCorrect(q: Pick<QuestionRow, "type" | "config" | "answerKey">): string {
  const c = q.config ?? {};
  const k = q.answerKey ?? {};
  const text = (list: { id: string; text: string }[] | undefined, id: string) => list?.find((x) => x.id === id)?.text ?? "";
  switch (q.type) {
    case "SINGLE": return text(c.choices, k.correctId);
    case "MULTI": return (k.correctIds ?? []).map((id: string) => text(c.choices, id)).join(" · ");
    case "TRUEFALSE": return k.value ? "ถูก" : "ผิด";
    case "SHORT": return (k.accepted ?? []).join(" / ");
    case "NUMBER": return `${k.value}${k.tolerance ? ` (คลาดเคลื่อนได้ ±${k.tolerance})` : ""}${c.unit ? ` ${c.unit}` : ""}`;
    case "MATCH": return (c.left ?? []).map((l: { id: string; text: string }) => `${l.text} → ${text(c.right, k.pairs?.[l.id])}`).join(" · ");
    case "ORDER": return (k.order ?? []).map((id: string, i: number) => `${i + 1}) ${text(c.items, id)}`).join("  ");
    case "CATEGORIZE":
      return (c.categories ?? [])
        .map((cat: { id: string; text: string }) => `${cat.text}: ${(c.items ?? []).filter((it: { id: string }) => k.map?.[it.id] === cat.id).map((it: { text: string }) => it.text).join(", ")}`)
        .join(" · ");
    case "CLOZE":
      return String(c.text ?? "").replace(/\{\{\s*([A-Za-z0-9_-]{1,40})\s*\}\}/g, (_m, id: string) => {
        const b = (c.blanks ?? []).find((x: { id: string }) => x.id === id);
        const kb = k.blanks?.[id] ?? {};
        return `[${b?.mode === "choose" ? text(b.options, kb.correctOptionId) : (kb.accepted ?? [])[0] ?? ""}]`;
      });
    default: return "";
  }
}

/** Per-question results for the browser. `reveal` = also include the correct answers and explanations. */
export function buildOutcome(questions: QuestionRow[], r: QuizResult, passPercent: number, reveal: boolean): QuizOutcome {
  const perQuestion: Record<string, QuestionOutcome> = {};
  for (const q of questions) {
    const g = r.perQuestion[q.id];
    perQuestion[q.id] = { status: g.status, points: g.points, max: g.max, ...(reveal ? { reveal: { answer: describeCorrect(q), explanation: q.explanation } } : {}) };
  }
  return { score: r.score, maxScore: r.maxScore, percent: r.percent, passed: r.passed, passPercent, perQuestion };
}
