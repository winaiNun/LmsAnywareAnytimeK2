/* eslint-disable @typescript-eslint/no-explicit-any -- converts between the editor's form state and the per-type JSON of schemas.ts */
/**
 * The question editor works with friendly form state (rows of inputs); the database stores `config` + `answerKey`.
 * These pure functions convert both ways, so the editor can reopen any saved question and the round trip is tested.
 * They never validate (the server does, with `parseQuestion`): an unfinished question simply converts to an unfinished JSON.
 */
import { clozePlaceholders, type QuestionType } from "./schemas";

export type Opt = { id: string; text: string };

export type EditorState =
  | { type: "SINGLE"; choices: Opt[]; correct: string }
  | { type: "MULTI"; choices: Opt[]; correct: string[]; scoring: "all" | "partial" }
  | { type: "TRUEFALSE"; value: boolean | null }
  | { type: "SHORT"; accepted: string; ignoreSpaces: boolean; caseSensitive: boolean; placeholder: string }
  | { type: "NUMBER"; value: string; tolerance: string; unit: string }
  | { type: "MATCH"; rows: { id: string; left: string; right: string }[]; distractors: string }
  | { type: "ORDER"; items: Opt[] }
  | { type: "CATEGORIZE"; categories: Opt[]; items: { id: string; text: string; categoryId: string }[] }
  | { type: "CLOZE"; text: string; blanks: { id: string; mode: "type" | "choose"; accepted: string; options: string; correct: number }[] };

const lines = (s: string) => s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const opt = (prefix: string, texts: string[]): Opt[] => texts.map((text, i) => ({ id: `${prefix}${i + 1}`, text }));

export function emptyState(type: QuestionType): EditorState {
  switch (type) {
    case "SINGLE": return { type, choices: opt("c", ["", "", ""]), correct: "c1" };
    case "MULTI": return { type, choices: opt("c", ["", "", "", ""]), correct: [], scoring: "all" };
    case "TRUEFALSE": return { type, value: null };
    case "SHORT": return { type, accepted: "", ignoreSpaces: true, caseSensitive: false, placeholder: "" };
    case "NUMBER": return { type, value: "", tolerance: "0", unit: "" };
    case "MATCH": return { type, rows: [1, 2, 3].map((n) => ({ id: `p${n}`, left: "", right: "" })), distractors: "" };
    case "ORDER": return { type, items: opt("o", ["", "", ""]) };
    case "CATEGORIZE": return { type, categories: opt("k", ["", ""]), items: [1, 2, 3, 4].map((n) => ({ id: `i${n}`, text: "", categoryId: "k1" })) };
    case "CLOZE": return { type, text: "", blanks: [] };
  }
}

/** Keep the CLOZE blank editors in step with the {{n}} marks typed in the sentence. */
export function syncBlanks(s: Extract<EditorState, { type: "CLOZE" }>): Extract<EditorState, { type: "CLOZE" }> {
  const marks = [...new Set(clozePlaceholders(s.text))];
  const old = new Map(s.blanks.map((b) => [b.id, b]));
  return { ...s, blanks: marks.map((id) => old.get(id) ?? { id, mode: "type" as const, accepted: "", options: "", correct: 0 }) };
}

export function stateFromQuestion(type: QuestionType, config: any, key: any): EditorState {
  const c = config ?? {};
  const k = key ?? {};
  switch (type) {
    case "SINGLE": return { type, choices: (c.choices ?? []).map((x: Opt) => ({ id: x.id, text: x.text })), correct: k.correctId ?? "" };
    case "MULTI": return { type, choices: (c.choices ?? []).map((x: Opt) => ({ id: x.id, text: x.text })), correct: k.correctIds ?? [], scoring: c.scoring === "partial" ? "partial" : "all" };
    case "TRUEFALSE": return { type, value: typeof k.value === "boolean" ? k.value : null };
    case "SHORT": return { type, accepted: (k.accepted ?? []).join("\n"), ignoreSpaces: k.ignoreSpaces !== false, caseSensitive: k.caseSensitive === true, placeholder: c.placeholder ?? "" };
    case "NUMBER": return { type, value: typeof k.value === "number" ? String(k.value) : "", tolerance: typeof k.tolerance === "number" ? String(k.tolerance) : "0", unit: c.unit ?? "" };
    case "MATCH": {
      const right = new Map<string, string>((c.right ?? []).map((r: Opt) => [r.id, r.text]));
      const used = new Set<string>(Object.values(k.pairs ?? {}));
      return {
        type,
        rows: (c.left ?? []).map((l: Opt) => ({ id: l.id, left: l.text, right: right.get(k.pairs?.[l.id]) ?? "" })),
        distractors: (c.right ?? []).filter((r: Opt) => !used.has(r.id)).map((r: Opt) => r.text).join("\n"),
      };
    }
    case "ORDER": {
      const byId = new Map<string, string>((c.items ?? []).map((x: Opt) => [x.id, x.text]));
      return { type, items: (k.order ?? (c.items ?? []).map((x: Opt) => x.id)).map((id: string) => ({ id, text: byId.get(id) ?? "" })) };
    }
    case "CATEGORIZE": return { type, categories: (c.categories ?? []).map((x: Opt) => ({ id: x.id, text: x.text })), items: (c.items ?? []).map((x: Opt) => ({ id: x.id, text: x.text, categoryId: k.map?.[x.id] ?? "" })) };
    case "CLOZE":
      return {
        type,
        text: c.text ?? "",
        blanks: (c.blanks ?? []).map((b: { id: string; mode: "type" | "choose"; options?: Opt[] }) => {
          const kb = k.blanks?.[b.id] ?? {};
          const options = b.options ?? [];
          return { id: b.id, mode: b.mode, accepted: (kb.accepted ?? []).join("\n"), options: options.map((o) => o.text).join("\n"), correct: Math.max(0, options.findIndex((o) => o.id === kb.correctOptionId)) };
        }),
      };
  }
}

export function stateToQuestion(s: EditorState): { config: any; answerKey: any } {
  switch (s.type) {
    case "SINGLE": return { config: { choices: s.choices.map((c) => ({ id: c.id, text: c.text.trim() })) }, answerKey: { correctId: s.correct } };
    case "MULTI": return { config: { choices: s.choices.map((c) => ({ id: c.id, text: c.text.trim() })), scoring: s.scoring }, answerKey: { correctIds: s.correct } };
    case "TRUEFALSE": return { config: {}, answerKey: s.value === null ? {} : { value: s.value } };
    case "SHORT": return { config: s.placeholder.trim() ? { placeholder: s.placeholder.trim() } : {}, answerKey: { accepted: lines(s.accepted), ignoreSpaces: s.ignoreSpaces, caseSensitive: s.caseSensitive } };
    case "NUMBER": {
      const v = Number(s.value.replace(/,/g, ""));
      const t = Number((s.tolerance || "0").replace(/,/g, ""));
      return { config: s.unit.trim() ? { unit: s.unit.trim() } : {}, answerKey: { value: s.value.trim() === "" || !Number.isFinite(v) ? null : v, tolerance: Number.isFinite(t) ? t : 0 } };
    }
    case "MATCH": {
      const left = s.rows.map((r, i) => ({ id: `l${i + 1}`, text: r.left.trim() }));
      const right = s.rows.map((r, i) => ({ id: `r${i + 1}`, text: r.right.trim() }));
      const extra = lines(s.distractors).map((text, i) => ({ id: `x${i + 1}`, text }));
      return { config: { left, right: [...right, ...extra] }, answerKey: { pairs: Object.fromEntries(left.map((l, i) => [l.id, right[i].id])) } };
    }
    case "ORDER": {
      const items = s.items.map((x, i) => ({ id: `o${i + 1}`, text: x.text.trim() }));
      return { config: { items }, answerKey: { order: items.map((x) => x.id) } };
    }
    case "CATEGORIZE": {
      const cats = s.categories.map((c, i) => ({ id: `k${i + 1}`, text: c.text.trim() }));
      const idOf = new Map(s.categories.map((c, i) => [c.id, `k${i + 1}`]));
      const items = s.items.map((x, i) => ({ id: `i${i + 1}`, text: x.text.trim() }));
      return { config: { categories: cats, items }, answerKey: { map: Object.fromEntries(s.items.map((x, i) => [`i${i + 1}`, idOf.get(x.categoryId) ?? ""])) } };
    }
    case "CLOZE": {
      const blanks = s.blanks.map((b) => {
        const options = lines(b.options).map((text, i) => ({ id: `${b.id}-o${i + 1}`, text }));
        return { id: b.id, mode: b.mode, ...(b.mode === "choose" ? { options } : {}) };
      });
      const keyBlanks = Object.fromEntries(
        s.blanks.map((b) => [b.id, b.mode === "choose" ? { correctOptionId: lines(b.options).length > b.correct ? `${b.id}-o${b.correct + 1}` : undefined } : { accepted: lines(b.accepted) }]),
      );
      return { config: { text: s.text.trim(), blanks }, answerKey: { blanks: keyBlanks } };
    }
  }
}
