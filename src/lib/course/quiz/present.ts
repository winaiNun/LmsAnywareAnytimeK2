/* eslint-disable @typescript-eslint/no-explicit-any -- question config / answer key are per-type JSON, validated by schemas.ts */
/**
 * What the browser gets before an attempt is handed in: the questions WITHOUT their answer key, in an order that comes
 * from the attempt's seed (so reloading the page shows the same order, and two learners see different orders).
 */
import type { QuestionRow } from "./grade";
import type { QuestionType } from "./schemas";

export type PublicQuestion = {
  id: string;
  type: QuestionType;
  points: number;
  prompt: string;
  imageUrl: string | null;
  config: any;
};

/** mulberry32: a tiny seeded random number generator (0 <= x < 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(list: readonly T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A stable number from a string, to give each question its own random stream. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function presentQuestion(q: QuestionRow, seed: number, shuffleChoices: boolean): PublicQuestion {
  const rng = seededRandom((seed ^ hash(q.id)) >>> 0);
  const c = q.config ?? {};
  let config: any = c;
  if (q.type === "SINGLE" || q.type === "MULTI") {
    config = { ...c, choices: shuffleChoices ? shuffled(c.choices, rng) : c.choices };
  } else if (q.type === "MATCH") {
    config = { ...c, right: shuffled(c.right, rng) }; // never in author order: that order may be the answer
  } else if (q.type === "ORDER") {
    let items = shuffled<{ id: string }>(c.items, rng);
    const correct: string[] = q.answerKey?.order ?? [];
    for (let tries = 0; tries < 5 && items.length > 1 && items.every((x, i) => x.id === correct[i]); tries++) items = shuffled(c.items, rng);
    config = { ...c, items };
  } else if (q.type === "CATEGORIZE") {
    config = { ...c, items: shuffled(c.items, rng) };
  } else if (q.type === "CLOZE") {
    config = { ...c, blanks: (c.blanks ?? []).map((b: { options?: unknown[] }) => (b.options && shuffleChoices ? { ...b, options: shuffled(b.options, rng) } : b)) };
  }
  return { id: q.id, type: q.type, points: q.points, prompt: q.prompt, imageUrl: q.imageUrl, config };
}

export function presentQuiz(questions: QuestionRow[], opts: { seed: number; shuffleQuestions: boolean; shuffleChoices: boolean }): PublicQuestion[] {
  const sorted = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const order = opts.shuffleQuestions ? shuffled(sorted, seededRandom(opts.seed >>> 0)) : sorted;
  return order.map((q) => presentQuestion(q, opts.seed, opts.shuffleChoices));
}

/** What the learner may see about a question after handing in (only when the quiz allows showing answers). */
export function revealQuestion(q: QuestionRow): { answerKey: unknown; explanation: string } {
  return { answerKey: q.answerKey, explanation: q.explanation };
}
