/* eslint-disable @typescript-eslint/no-explicit-any -- question config / answer key are per-type JSON, validated by schemas.ts */
/**
 * The nine question types and what each one stores. Every question has two JSON parts that are kept apart on purpose:
 *   config    = what the learner sees (the choices, the pairs to match, ...)
 *   answerKey = the answers; it is never sent to the browser before the attempt is handed in.
 * `parseQuestion` checks both (the editor saves through it, and a course can not be sent for review while it fails).
 */
import { z } from "zod";

export const QUESTION_TYPES = ["SINGLE", "MULTI", "TRUEFALSE", "SHORT", "NUMBER", "MATCH", "ORDER", "CATEGORIZE", "CLOZE"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE: "ปรนัย เลือกคำตอบเดียว",
  MULTI: "ปรนัย เลือกได้หลายข้อ",
  TRUEFALSE: "ถูก / ผิด",
  SHORT: "เติมคำตอบสั้น",
  NUMBER: "ตอบเป็นตัวเลข",
  MATCH: "จับคู่",
  ORDER: "เรียงลำดับ",
  CATEGORIZE: "จัดหมวดหมู่",
  CLOZE: "เติมช่องว่างในประโยค",
};

const id = z.string().trim().min(1).max(40);
const text = (max = 300) => z.string().trim().min(1, "กรุณากรอกข้อความให้ครบ").max(max);
const option = z.object({ id, text: text() });

/** ids inside one list must be unique */
const unique = (list: { id: string }[]) => new Set(list.map((x) => x.id)).size === list.length;

const single = {
  config: z.object({ choices: z.array(option).min(2, "ต้องมีตัวเลือกอย่างน้อย 2 ข้อ").max(10).refine(unique, "รหัสตัวเลือกซ้ำ") }),
  key: z.object({ correctId: id }),
};
const multi = {
  config: z.object({ choices: z.array(option).min(2, "ต้องมีตัวเลือกอย่างน้อย 2 ข้อ").max(10).refine(unique, "รหัสตัวเลือกซ้ำ"), scoring: z.enum(["all", "partial"]).default("all") }),
  key: z.object({ correctIds: z.array(id).min(1, "ต้องมีคำตอบที่ถูกอย่างน้อย 1 ข้อ").max(10) }),
};
const trueFalse = { config: z.object({}), key: z.object({ value: z.boolean() }) };
const short = {
  config: z.object({ placeholder: z.string().trim().max(60).optional() }),
  key: z.object({ accepted: z.array(text(120)).min(1, "ต้องมีคำตอบที่ยอมรับอย่างน้อย 1 คำตอบ").max(20), ignoreSpaces: z.boolean().default(true), caseSensitive: z.boolean().default(false) }),
};
const number = {
  config: z.object({ unit: z.string().trim().max(20).optional() }),
  key: z.object({ value: z.number().finite(), tolerance: z.number().finite().min(0).default(0) }),
};
const match = {
  config: z.object({
    left: z.array(option).min(2, "ต้องมีรายการฝั่งซ้ายอย่างน้อย 2 ข้อ").max(10).refine(unique, "รหัสซ้ำ"),
    right: z.array(option).min(2).max(12).refine(unique, "รหัสซ้ำ"), // may hold extra "distractors"
  }),
  key: z.object({ pairs: z.record(z.string(), id) }),
};
const order = {
  config: z.object({ items: z.array(option).min(2, "ต้องมีรายการอย่างน้อย 2 ข้อ").max(10).refine(unique, "รหัสซ้ำ") }),
  key: z.object({ order: z.array(id).min(2, "ลำดับที่ถูกต้องต้องมีครบทุกรายการ").max(10) }),
};
const categorize = {
  config: z.object({
    categories: z.array(option).min(2, "ต้องมีหมวดอย่างน้อย 2 หมวด").max(6).refine(unique, "รหัสซ้ำ"),
    items: z.array(option).min(2, "ต้องมีรายการอย่างน้อย 2 ข้อ").max(16).refine(unique, "รหัสซ้ำ"),
  }),
  key: z.object({ map: z.record(z.string(), id) }),
};
const cloze = {
  config: z.object({
    text: z.string().trim().min(3, "กรุณากรอกประโยค").max(1500), // blanks are written {{1}}, {{2}}, ...
    blanks: z
      .array(z.object({ id, mode: z.enum(["type", "choose"]), options: z.array(option).max(8).optional() }))
      .min(1, "ต้องมีช่องว่างอย่างน้อย 1 ช่อง")
      .max(10),
  }),
  key: z.object({ blanks: z.record(z.string(), z.object({ accepted: z.array(text(120)).max(20).optional(), correctOptionId: id.optional() })) }),
};

const SCHEMAS = { SINGLE: single, MULTI: multi, TRUEFALSE: trueFalse, SHORT: short, NUMBER: number, MATCH: match, ORDER: order, CATEGORIZE: categorize, CLOZE: cloze } as const;

export type ParsedQuestion = { type: QuestionType; config: Record<string, unknown>; answerKey: Record<string, unknown> };

const first = (e: z.ZodError) => e.issues[0]?.message ?? "ข้อมูลคำถามไม่ถูกต้อง";

/** Placeholders like {{1}} used in the cloze text, in order of appearance. */
export const clozePlaceholders = (t: string): string[] => Array.from(t.matchAll(/\{\{\s*([A-Za-z0-9_-]{1,40})\s*\}\}/g), (m) => m[1]);

/** Validate config + answer key of one question (including the links between them: the key must point at real ids). */
export function parseQuestion(type: string, rawConfig: unknown, rawKey: unknown): { ok: true; value: ParsedQuestion } | { ok: false; error: string } {
  if (!(QUESTION_TYPES as readonly string[]).includes(type)) return { ok: false, error: "ชนิดคำถามไม่ถูกต้อง" };
  const t = type as QuestionType;
  const sc = SCHEMAS[t];
  const c = sc.config.safeParse(rawConfig ?? {});
  if (!c.success) return { ok: false, error: first(c.error) };
  const k = sc.key.safeParse(rawKey ?? {});
  if (!k.success) {
    const msg = k.error.issues[0]?.message ?? "";
    return { ok: false, error: t === "TRUEFALSE" ? "กรุณาเลือกว่าข้อความนี้ถูกหรือผิด" : /[฀-๿]/.test(msg) ? msg : "กรุณาตั้งเฉลยให้ครบ" }; // our own Thai messages pass through
  }
  const config = c.data as Record<string, any>;
  const key = k.data as Record<string, any>;
  const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id));

  if (t === "SINGLE" && !ids(config.choices).has(key.correctId)) return { ok: false, error: "เฉลยต้องเป็นหนึ่งในตัวเลือก" };
  if (t === "MULTI") {
    const have = ids(config.choices);
    if (!key.correctIds.every((x: string) => have.has(x)) || new Set(key.correctIds).size !== key.correctIds.length) return { ok: false, error: "เฉลยต้องเป็นตัวเลือกที่มีอยู่และไม่ซ้ำ" };
  }
  if (t === "NUMBER" && key.tolerance > Math.abs(key.value) * 10 + 1000) return { ok: false, error: "ค่าคลาดเคลื่อนที่ยอมรับมากเกินไป" };
  if (t === "MATCH") {
    const left = ids(config.left);
    const right = ids(config.right);
    const pairs = key.pairs as Record<string, string>;
    if (!config.left.every((x: { id: string }) => pairs[x.id] && right.has(pairs[x.id]))) return { ok: false, error: "ต้องจับคู่ให้ครบทุกรายการฝั่งซ้าย" };
    if (Object.keys(pairs).some((x) => !left.has(x))) return { ok: false, error: "เฉลยการจับคู่ไม่ถูกต้อง" };
    if (new Set(Object.values(pairs)).size !== Object.keys(pairs).length) return { ok: false, error: "รายการฝั่งขวาหนึ่งข้อจับคู่ได้เพียงข้อเดียว" };
  }
  if (t === "ORDER") {
    const have = ids(config.items);
    if (key.order.length !== config.items.length || !key.order.every((x: string) => have.has(x)) || new Set(key.order).size !== key.order.length) return { ok: false, error: "ลำดับที่ถูกต้องต้องมีครบทุกรายการ" };
  }
  if (t === "CATEGORIZE") {
    const cats = ids(config.categories);
    const map = key.map as Record<string, string>;
    if (!config.items.every((x: { id: string }) => map[x.id] && cats.has(map[x.id]))) return { ok: false, error: "ต้องกำหนดหมวดที่ถูกต้องให้ครบทุกรายการ" };
  }
  if (t === "CLOZE") {
    const marks = clozePlaceholders(config.text);
    const blanks = config.blanks as { id: string; mode: string; options?: { id: string }[] }[];
    const blankIds = blanks.map((b) => b.id);
    if (new Set(blankIds).size !== blankIds.length) return { ok: false, error: "รหัสช่องว่างซ้ำ" };
    if (marks.length !== blankIds.length || !marks.every((m) => blankIds.includes(m))) return { ok: false, error: "จำนวนช่องว่างในประโยคต้องตรงกับที่ตั้งไว้ (เขียนเป็น {{1}} {{2}} ...)" };
    for (const b of blanks) {
      const kb = (key.blanks as Record<string, { accepted?: string[]; correctOptionId?: string }>)[b.id];
      if (!kb) return { ok: false, error: `ยังไม่ได้ตั้งเฉลยของช่องว่าง ${b.id}` };
      if (b.mode === "type" && !(kb.accepted && kb.accepted.length > 0)) return { ok: false, error: `ช่องว่าง ${b.id} ต้องมีคำตอบที่ยอมรับ` };
      if (b.mode === "choose") {
        if (!b.options || b.options.length < 2 || !unique(b.options)) return { ok: false, error: `ช่องว่าง ${b.id} ต้องมีตัวเลือกอย่างน้อย 2 ข้อ` };
        if (!kb.correctOptionId || !b.options.some((o) => o.id === kb.correctOptionId)) return { ok: false, error: `ช่องว่าง ${b.id} ต้องเลือกคำตอบที่ถูก` };
      }
    }
  }
  return { ok: true, value: { type: t, config, answerKey: key } };
}

/** What a learner hands in for each type (checked loosely; the grader treats anything unexpected as "no answer"). */
export type Answer = Record<string, unknown>;
