/**
 * Multiple-choice questions typed in a spreadsheet -> the question format of the quiz builder. Pure (no database): the
 * server action reads the file, calls `parseQuizSheet`, shows the preview, and `importQuestionsAs` saves what is valid.
 * Tests: `npm run test:quizimport`.
 *
 * One row = one question: the question, 2-8 choices (columns ก ข ค ง จ ฉ ช ซ), the answer ("ก" or "ข,ค" — Thai letters,
 * A-H or 1-8), optional points / explanation / picture link. One right answer = "เลือกคำตอบเดียว", several = "เลือกได้หลายข้อ".
 */
import { MAX_QUESTIONS_PER_QUIZ } from "@/lib/course/access";
import { parseDriveFileId } from "@/lib/drive";
import { safeHttpsUrl } from "@/lib/embed";
import { toArabicDigits } from "./normalise";
import { parseQuestion } from "./schemas";

export const THAI_LETTERS = ["ก", "ข", "ค", "ง", "จ", "ฉ", "ช", "ซ"] as const;
export const MAX_IMPORT_CHOICES = THAI_LETTERS.length;
export const EXAMPLE_PREFIX = "(ตัวอย่าง)";
export const QUIZ_SHEET_NAME = "แบบทดสอบ";

export type ImportedQuestion = {
  type: "SINGLE" | "MULTI";
  points: number;
  prompt: string;
  imageUrl: string;
  explanation: string;
  config: Record<string, unknown>;
  answerKey: Record<string, unknown>;
};

export type ImportRow = {
  rowNo: number; // the row number in the spreadsheet (1 = header)
  prompt: string;
  choices: string[]; // texts of the filled choices, in column order
  correct: string[]; // letters of the right answers, e.g. ["ก", "ค"]
  points: number;
  errors: string[];
  warnings: string[];
  question: ImportedQuestion | null; // null when there are errors
};

export type ImportParse =
  | { ok: false; error: string }
  | { ok: true; rows: ImportRow[]; exampleRows: number; valid: number; invalid: number };

// ---------- headers ----------

const norm = (s: string) => toArabicDigits(String(s ?? "")).normalize("NFC").replace(/[​-‍﻿]/g, "").replace(/\s+/g, "").toLowerCase();

const ALIASES = {
  prompt: ["คำถาม", "โจทย์", "ข้อสอบ", "question", "คำถามข้อสอบ"],
  answer: ["เฉลย", "คำตอบ", "คำตอบที่ถูก", "คำตอบที่ถูกต้อง", "answer", "key"],
  points: ["คะแนน", "คะแนนต่อข้อ", "points", "score"],
  explanation: ["คำอธิบายเฉลย", "คำอธิบาย", "อธิบาย", "เหตุผล", "explanation"],
  image: ["ลิงก์รูปประกอบ", "ลิงก์รูป", "รูปประกอบ", "รูปภาพ", "รูป", "image"],
} as const;

/** "ตัวเลือก ก" / "ก" / "choice A" / "ตัวเลือก 1" -> position 0..7, or -1 */
function choiceIndex(header: string): number {
  const m = norm(header).match(/^(?:ตัวเลือก|choice|option|ข้อ)?([ก-ซ]|[a-h]|[1-8])$/);
  if (!m) return -1;
  const t = m[1];
  const thai = THAI_LETTERS.indexOf(t as (typeof THAI_LETTERS)[number]);
  if (thai >= 0) return thai;
  if (/^[a-h]$/.test(t)) return t.charCodeAt(0) - 97;
  return Number(t) - 1;
}

export type HeaderMap = { prompt: number; answer: number; points: number; explanation: number; image: number; choices: { col: number; pos: number }[]; missing: string[] };

export function mapQuizHeaders(row: string[]): HeaderMap {
  const find = (names: readonly string[]) => row.findIndex((h) => names.map(norm).includes(norm(h)));
  const choices: { col: number; pos: number }[] = [];
  row.forEach((h, col) => { const pos = choiceIndex(h); if (pos >= 0 && !choices.some((c) => c.pos === pos)) choices.push({ col, pos }); });
  const map: HeaderMap = { prompt: find(ALIASES.prompt), answer: find(ALIASES.answer), points: find(ALIASES.points), explanation: find(ALIASES.explanation), image: find(ALIASES.image), choices, missing: [] };
  if (map.prompt < 0) map.missing.push("คำถาม");
  if (choices.length < 2) map.missing.push("ตัวเลือก ก, ตัวเลือก ข (อย่างน้อย 2 คอลัมน์)");
  if (map.answer < 0) map.missing.push("เฉลย");
  return map;
}

// ---------- the answer cell ----------

/** "ข" / "ข,ค" / "B C" / "2 และ 3" / "ก." -> positions (0-based), or the first token that is not understood. */
export function parseAnswerCell(raw: string): { positions: number[]; bad: string | null } {
  const text = toArabicDigits(String(raw ?? "")).normalize("NFC").trim();
  const tokens = text.split(/\s*(?:และ|,|，|、|;|；|\/|\||\s)\s*/).map((t) => t.replace(/[.)\]】]+$/g, "").replace(/^[(\[【]+/g, "").trim()).filter(Boolean);
  const positions: number[] = [];
  for (const t of tokens) {
    const thai = THAI_LETTERS.indexOf(t as (typeof THAI_LETTERS)[number]);
    let pos = thai;
    if (pos < 0 && /^[a-hA-H]$/.test(t)) pos = t.toLowerCase().charCodeAt(0) - 97;
    if (pos < 0 && /^[1-8]$/.test(t)) pos = Number(t) - 1;
    if (pos < 0) return { positions, bad: t };
    if (!positions.includes(pos)) positions.push(pos);
  }
  return { positions, bad: null };
}

// ---------- the rows ----------

function imageProblem(raw: string): string | null {
  if (!raw) return null;
  if (parseDriveFileId(raw)) return null;
  const r = safeHttpsUrl(raw);
  return "error" in r ? `ลิงก์รูป: ${r.error}` : null;
}

export function parseQuizRow(rowNo: number, cells: string[], map: HeaderMap, opts: { partialScoring: boolean }): ImportRow {
  const get = (col: number) => (col >= 0 ? String(cells[col] ?? "").replace(/\r\n/g, "\n").trim() : "");
  const prompt = get(map.prompt);
  const filled = map.choices.map((c) => ({ pos: c.pos, text: get(c.col) })).filter((c) => c.text !== "").sort((a, b) => a.pos - b.pos);
  const answerRaw = get(map.answer);
  const errors: string[] = [];
  const warnings: string[] = [];
  const row: ImportRow = { rowNo, prompt, choices: filled.map((c) => c.text), correct: [], points: 1, errors, warnings, question: null };

  if (!prompt) errors.push("ไม่มีคำถาม");
  if (filled.length < 2) errors.push("ต้องมีตัวเลือกอย่างน้อย 2 ข้อ");
  if (new Set(filled.map((c) => c.text.toLowerCase())).size < filled.length) warnings.push("มีตัวเลือกที่ข้อความซ้ำกัน");

  // points
  const pointsRaw = toArabicDigits(get(map.points));
  if (pointsRaw) {
    const n = Number(pointsRaw);
    if (!Number.isInteger(n) || n < 1 || n > 100) errors.push("คะแนนต้องเป็นจำนวนเต็ม 1–100");
    else row.points = n;
  }

  // answer
  let correctPos: number[] = [];
  if (!answerRaw) errors.push("ไม่ได้ระบุเฉลย");
  else {
    const a = parseAnswerCell(answerRaw);
    if (a.bad !== null) {
      // maybe the answer was written as the full text of a choice
      const byText = filled.find((c) => c.text.toLowerCase() === answerRaw.toLowerCase());
      if (byText) correctPos = [byText.pos];
      else errors.push(`เฉลย “${a.bad}” ไม่เข้าใจ — ใช้ ก ข ค ง หรือ A B C D หรือ 1 2 3 4 (หลายข้อคั่นด้วยเครื่องหมายจุลภาค)`);
    } else if (a.positions.length === 0) errors.push("ไม่ได้ระบุเฉลย");
    else correctPos = a.positions;
  }
  const missing = correctPos.filter((p) => !filled.some((c) => c.pos === p));
  if (missing.length) errors.push(`เฉลย ${missing.map((p) => THAI_LETTERS[p]).join(", ")} ชี้ไปที่ตัวเลือกที่ว่างอยู่`);
  row.correct = correctPos.filter((p) => !missing.includes(p)).map((p) => THAI_LETTERS[p]);

  const image = get(map.image);
  const imgErr = imageProblem(image);
  if (imgErr) errors.push(imgErr);

  if (errors.length) return row;

  const choices = filled.map((c) => ({ id: `c${c.pos + 1}`, text: c.text }));
  const ids = correctPos.map((p) => `c${p + 1}`);
  const type = ids.length === 1 ? "SINGLE" : "MULTI";
  const config = type === "SINGLE" ? { choices } : { choices, scoring: opts.partialScoring ? "partial" : "all" };
  const answerKey = type === "SINGLE" ? { correctId: ids[0] } : { correctIds: ids };
  // the same checker the quiz builder uses, so an imported question can never be one the builder would refuse
  const checked = parseQuestion(type, config, answerKey);
  if (!checked.ok) { errors.push(checked.error); return row; }
  if (prompt.length > 2000) { errors.push("คำถามยาวเกิน 2,000 ตัวอักษร"); return row; }
  const explanation = get(map.explanation);
  if (explanation.length > 2000) { errors.push("คำอธิบายเฉลยยาวเกิน 2,000 ตัวอักษร"); return row; }
  row.question = { type, points: row.points, prompt, imageUrl: image, explanation, config, answerKey };
  return row;
}

/** All the rows of a sheet (the first rows may be a title; the header is looked for in the first 5). Example rows are skipped. */
export function parseQuizSheet(rows: string[][], opts: { partialScoring?: boolean } = {}): ImportParse {
  let headerAt = -1;
  let map: HeaderMap | null = null;
  let best: HeaderMap | null = null;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const m = mapQuizHeaders(rows[i]);
    if (m.missing.length === 0) { headerAt = i; map = m; break; }
    if (!best || m.missing.length < best.missing.length) best = m;
  }
  if (!map) return { ok: false, error: `ไม่พบหัวคอลัมน์ที่จำเป็น: ${(best ?? mapQuizHeaders([])).missing.join(", ")} — ดาวน์โหลดแม่แบบเพื่อดูรูปแบบที่ถูกต้อง` };

  const out: ImportRow[] = [];
  let exampleRows = 0;
  for (let i = headerAt + 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.every((c) => !String(c ?? "").trim())) continue; // an empty row
    const first = String(cells[map.prompt] ?? "").trim();
    if (first.startsWith(EXAMPLE_PREFIX)) { exampleRows++; continue; }
    out.push(parseQuizRow(i + 1, cells, map, { partialScoring: !!opts.partialScoring }));
  }
  if (out.length === 0) return { ok: false, error: exampleRows > 0 ? "มีแต่แถวตัวอย่าง — ลบแถวตัวอย่างแล้วกรอกข้อสอบของคุณ หรือพิมพ์ข้อสอบต่อจากแถวตัวอย่าง" : "ไม่พบแถวข้อสอบ" };
  const valid = out.filter((r) => r.question).length;
  return { ok: true, rows: out, exampleRows, valid, invalid: out.length - valid };
}

export { MAX_QUESTIONS_PER_QUIZ };
