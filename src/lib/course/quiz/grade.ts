/* eslint-disable @typescript-eslint/no-explicit-any -- question config / answer key are per-type JSON, validated by schemas.ts */
/**
 * Grading. Everything the learner sends is untrusted: each grader reads only the shape it expects and treats anything
 * else as "no answer". Partial credit: MULTI (optional), MATCH, ORDER, CATEGORIZE and CLOZE give a share of the points.
 */
import { normaliseText, parseNumber } from "./normalise";
import type { Answer, QuestionType } from "./schemas";

export type QuestionRow = {
  id: string;
  type: QuestionType;
  points: number;
  prompt: string;
  imageUrl: string | null;
  explanation: string;
  sortOrder: number;
  config: any;
  answerKey: any;
};

export type GradeResult = { fraction: number; points: number; max: number; status: "correct" | "partial" | "wrong" | "blank" };

const round2 = (n: number) => Math.round(n * 100) / 100;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function result(max: number, fraction: number, blank: boolean): GradeResult {
  const f = Math.max(0, Math.min(1, fraction));
  return { fraction: f, points: round2(max * f), max, status: blank ? "blank" : f >= 1 ? "correct" : f > 0 ? "partial" : "wrong" };
}

export function gradeQuestion(q: Pick<QuestionRow, "type" | "points" | "config" | "answerKey">, answer: Answer | undefined | null): GradeResult {
  const a: Answer = isObj(answer) ? answer : {};
  const max = q.points;
  const key = q.answerKey ?? {};
  const cfg = q.config ?? {};

  switch (q.type) {
    case "SINGLE": {
      const pick = str(a.choiceId);
      return result(max, pick && pick === key.correctId ? 1 : 0, !pick);
    }
    case "MULTI": {
      const valid = new Set<string>((cfg.choices ?? []).map((c: { id: string }) => c.id));
      const picked = new Set(strList(a.choiceIds).filter((x) => valid.has(x)));
      if (picked.size === 0) return result(max, 0, true);
      const correct = new Set<string>(key.correctIds ?? []);
      const right = [...picked].filter((x) => correct.has(x)).length;
      const wrong = picked.size - right;
      if (cfg.scoring === "partial") return result(max, (right - wrong) / correct.size, false);
      return result(max, right === correct.size && wrong === 0 ? 1 : 0, false);
    }
    case "TRUEFALSE": {
      if (typeof a.value !== "boolean") return result(max, 0, true);
      return result(max, a.value === key.value ? 1 : 0, false);
    }
    case "SHORT": {
      const typed = str(a.text);
      if (!normaliseText(typed)) return result(max, 0, true);
      const opts = { ignoreSpaces: key.ignoreSpaces !== false, caseSensitive: key.caseSensitive === true };
      const given = normaliseText(typed, opts);
      const ok = (key.accepted as string[] | undefined)?.some((x) => normaliseText(x, opts) === given);
      return result(max, ok ? 1 : 0, false);
    }
    case "NUMBER": {
      const raw = typeof a.text === "number" ? String(a.text) : str(a.text);
      if (!raw.trim()) return result(max, 0, true);
      const n = parseNumber(raw);
      if (n === null || typeof key.value !== "number") return result(max, 0, false);
      return result(max, Math.abs(n - key.value) <= (key.tolerance ?? 0) + 1e-9 ? 1 : 0, false);
    }
    case "MATCH": {
      const pairs = isObj(a.pairs) ? a.pairs : {};
      const left: { id: string }[] = cfg.left ?? [];
      const given = left.filter((l) => str(pairs[l.id]));
      if (given.length === 0) return result(max, 0, true);
      const right = given.filter((l) => pairs[l.id] === key.pairs?.[l.id]).length;
      return result(max, right / left.length, false);
    }
    case "ORDER": {
      const order = strList(a.order);
      const want: string[] = key.order ?? [];
      if (order.length === 0) return result(max, 0, true);
      // an answer must not repeat an item; a repeated id scores nothing for that place
      const seen = new Set<string>();
      let right = 0;
      want.forEach((id, i) => {
        if (order[i] === id && !seen.has(id)) right++;
        seen.add(order[i] ?? "");
      });
      return result(max, right / want.length, false);
    }
    case "CATEGORIZE": {
      const map = isObj(a.map) ? a.map : {};
      const items: { id: string }[] = cfg.items ?? [];
      const given = items.filter((i) => str(map[i.id]));
      if (given.length === 0) return result(max, 0, true);
      const right = given.filter((i) => map[i.id] === key.map?.[i.id]).length;
      return result(max, right / items.length, false);
    }
    case "CLOZE": {
      const given = isObj(a.blanks) ? a.blanks : {};
      const blanks: { id: string; mode: "type" | "choose" }[] = cfg.blanks ?? [];
      const filled = blanks.filter((b) => normaliseText(str(given[b.id])));
      if (filled.length === 0) return result(max, 0, true);
      let right = 0;
      for (const b of blanks) {
        const kb = key.blanks?.[b.id] ?? {};
        const v = str(given[b.id]);
        if (b.mode === "choose") {
          if (v && v === kb.correctOptionId) right++;
        } else {
          const g = normaliseText(v, { ignoreSpaces: true });
          if (g && (kb.accepted as string[] | undefined)?.some((x) => normaliseText(x, { ignoreSpaces: true }) === g)) right++;
        }
      }
      return result(max, right / blanks.length, false);
    }
    default:
      return result(max, 0, true);
  }
}

export type QuizResult = { score: number; maxScore: number; percent: number; passed: boolean; perQuestion: Record<string, GradeResult> };

export function gradeQuiz(questions: QuestionRow[], answers: Record<string, Answer | undefined>, passPercent: number): QuizResult {
  const perQuestion: Record<string, GradeResult> = {};
  let score = 0;
  let maxScore = 0;
  for (const q of questions) {
    const r = gradeQuestion(q, answers?.[q.id]);
    perQuestion[q.id] = r;
    score += r.points;
    maxScore += r.max;
  }
  score = round2(score);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return { score, maxScore, percent, passed: maxScore > 0 && percent >= passPercent, perQuestion };
}
