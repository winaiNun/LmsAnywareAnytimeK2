/**
 * FAQ matching: pure functions, no database. A visitor's sentence is compared with each question and its keywords
 * in memory (Thai has no spaces, so words come from Intl.Segmenter and a character-bigram similarity covers typos
 * and different word boundaries).
 */
import { normaliseText } from "@/lib/course/quiz/normalise";

export type FaqEntry = { id: string; question: string; keywords: string };
export type FaqMatch = { id: string; score: number };
export type MatchResult =
  | { kind: "answer"; best: FaqMatch; related: FaqMatch[] }
  | { kind: "suggest"; items: FaqMatch[] }
  | { kind: "none" };

export const ANSWER_THRESHOLD = 0.6; // at least this = answer straight away
export const SUGGEST_THRESHOLD = 0.3; // between this and the answer line = "did you mean ...?"
export const MAX_QUERY_LENGTH = 200;
const MAX_SUGGESTIONS = 3;

// Words that carry no topic: politeness particles and question words.
const STOP = new Set([
  "ครับ", "ค่ะ", "คะ", "นะ", "จ้า", "จ้ะ", "หรือ", "ไหม", "มั้ย", "อะไร", "ยังไง", "อย่างไร", "ได้", "ที่", "และ", "ของ", "ใน", "คือ",
  "ผม", "ฉัน", "หนู", "เรา", "จะ", "ต้อง", "ช่วย", "หน่อย", "แล้ว", "เป็น", "มี", "the", "a", "is", "how", "do", "i", "to",
]);

let segmenter: Intl.Segmenter | null | undefined;
function words(text: string): string[] {
  if (segmenter === undefined) {
    try {
      segmenter = new Intl.Segmenter("th", { granularity: "word" });
    } catch {
      segmenter = null;
    }
  }
  if (!segmenter) return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const out: string[] = [];
  for (const s of segmenter.segment(text)) if (s.isWordLike) out.push(s.segment);
  return out;
}

/** Lower-cased, digits unified, punctuation removed. */
export const clean = (s: string) => normaliseText(s).replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ").replace(/\s+/g, " ").trim();

export function tokens(text: string): string[] {
  return words(clean(text)).filter((w) => w.length > 0 && !STOP.has(w));
}

function bigrams(s: string): string[] {
  const t = s.replace(/\s/g, "");
  if (t.length < 2) return t ? [t] : [];
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** Dice coefficient on character bigrams, 0..1. */
export function dice(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  if (!x.length || !y.length) return 0;
  const counts = new Map<string, number>();
  for (const g of y) counts.set(g, (counts.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of x) {
    const n = counts.get(g) ?? 0;
    if (n > 0) {
      hit++;
      counts.set(g, n - 1);
    }
  }
  return (2 * hit) / (x.length + y.length);
}

/** Keywords are separated by commas, "|", or line breaks (spaces belong to a phrase such as "ลืมรหัสผ่าน"). */
export function keywordList(keywords: string): string[] {
  return keywords.split(/[,\n|]/).map(clean).filter((k) => k.length >= 2);
}

export function scoreEntry(query: string, entry: FaqEntry): number {
  const q = clean(query);
  if (!q) return 0;
  const question = clean(entry.question);
  if (q === question) return 1;

  const kws = keywordList(entry.keywords);
  const qNoSpace = q.replace(/\s/g, "");
  // a whole keyword phrase inside the sentence (or the sentence inside a keyword) is a strong hit
  const phrase = kws.some((k) => {
    const kn = k.replace(/\s/g, "");
    return qNoSpace.includes(kn) || (qNoSpace.length >= 3 && kn.includes(qNoSpace));
  });

  const docTokens = new Set([...tokens(entry.question), ...kws.flatMap(tokens)]);
  const qTokens = tokens(q);
  let total = 0;
  let found = 0;
  for (const t of qTokens) {
    const w = Math.min(t.length, 6); // longer words say more than short ones
    total += w;
    if (docTokens.has(t)) found += w;
  }
  const coverage = total ? found / total : 0;
  const sim = Math.max(dice(q, question), ...kws.map((k) => dice(q, k)));
  const base = 0.7 * coverage + 0.3 * sim;
  return Math.min(1, Math.max(base, phrase ? 0.85 : 0, sim >= 0.8 ? sim : 0));
}

export function matchFaq(query: string, entries: FaqEntry[]): MatchResult {
  const q = String(query ?? "").slice(0, MAX_QUERY_LENGTH);
  if (!clean(q)) return { kind: "none" };
  const ranked = entries
    .map((e) => ({ id: e.id, score: scoreEntry(q, e) }))
    .filter((m) => m.score >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return { kind: "none" };
  // two entries almost tied (a one-word question such as "รหัส") -> let the visitor choose instead of guessing
  const tied = ranked.length > 1 && ranked[0].score < 1 && ranked[0].score - ranked[1].score < 0.05;
  if (ranked[0].score >= ANSWER_THRESHOLD && !tied) return { kind: "answer", best: ranked[0], related: ranked.slice(1, 1 + MAX_SUGGESTIONS) };
  return { kind: "suggest", items: ranked.slice(0, MAX_SUGGESTIONS) };
}

/** Same question typed slightly differently -> same key (for counting unanswered questions). */
export const normaliseQuestion = (q: string) => clean(q).replace(/\s/g, "").slice(0, MAX_QUERY_LENGTH);
