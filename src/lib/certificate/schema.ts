/**
 * Certificate rules that need no database: the text fields of a design, the {tokens} inside them, running numbers,
 * and which design a learner gets. Safe in server code, client components and scripts. Tests: `npm run test:cert`.
 *
 * Geometry is stored as percentages of the template picture (x, y = centre of the text line, w = width), and the font
 * size as "px on a 1000 px wide certificate", so the same design draws identically on a phone, a desktop and paper.
 */
import { formatThaiDate, toBE, bangkokParts } from "@/lib/thai-date";

export const FIELD_KEYS = ["name", "number", "date", "course", "type", "award", "extra"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export type CertField = {
  key: FieldKey;
  enabled: boolean;
  text: string; // may contain {tokens}
  x: number; // 0-100, left edge of the text box (% of width)
  y: number; // 0-100, vertical centre of the line (% of height)
  w: number; // 1-100, width of the text box (% of width)
  size: number; // font size on a 1000 px wide certificate
  color: string; // #rrggbb
  align: "left" | "center" | "right";
  font: string; // "sarabun-400|500|600|700" or "f:<CertificateFont id>"
};

export const FIELD_LABEL: Record<FieldKey, { label: string; hint: string }> = {
  name: { label: "ชื่อผู้เรียน", hint: "ดึงจากชื่อสมาชิก (คำนำหน้าติดชื่อ)" },
  number: { label: "เลขที่เกียรติบัตร", hint: "ได้เมื่อออกเลขแล้ว" },
  date: { label: "วันที่", hint: "วันที่เรียนจบ (เปลี่ยนเป็นวันที่ออกเลขได้ด้วย {issued})" },
  course: { label: "ชื่อหลักสูตร", hint: "ดึงจากชื่อคอร์ส" },
  type: { label: "ประเภท", hint: "ข้อความที่พิมพ์เอง เช่น “ผ่านการอบรม”" },
  award: { label: "รางวัล / ผลการเรียน", hint: "เช่น “ผลคะแนนสอบ {score}%”" },
  extra: { label: "ข้อความเพิ่มเติม", hint: "ข้อความที่พิมพ์เอง เช่น ชื่อหน่วยงานหรือผู้ลงนาม" },
};

export const TOKENS = [
  { token: "name", label: "ชื่อผู้เรียน", example: "นายสมชาย ใจดี" },
  { token: "number", label: "เลขที่เกียรติบัตร", example: "0001/2569" },
  { token: "date", label: "วันที่เรียนจบ", example: "11 ตุลาคม 2569" },
  { token: "issued", label: "วันที่ออกเลข", example: "15 ตุลาคม 2569" },
  { token: "course", label: "ชื่อหลักสูตร", example: "การใช้ AI ในงานครู" },
  { token: "score", label: "คะแนนแบบทดสอบเฉลี่ย (%)", example: "92" },
  { token: "hours", label: "จำนวนชั่วโมงอบรม", example: "6" },
  { token: "instructor", label: "ผู้สอน", example: "ครูตัวอย่าง" },
  { token: "school", label: "โรงเรียน/หน่วยงาน", example: "โรงเรียนตัวอย่าง" },
  { token: "code", label: "รหัสตรวจสอบเกียรติบัตร", example: "K7M2Q9XA4HTB" },
] as const;
export type TokenName = (typeof TOKENS)[number]["token"];
export type CertValues = Record<TokenName, string>;

export const SAMPLE_VALUES: CertValues = Object.fromEntries(TOKENS.map((t) => [t.token, t.example])) as CertValues;

export const BUILTIN_FONTS = [
  { key: "sarabun-400", label: "Sarabun ปกติ", weight: 400 },
  { key: "sarabun-500", label: "Sarabun กลาง", weight: 500 },
  { key: "sarabun-600", label: "Sarabun หนา", weight: 600 },
  { key: "sarabun-700", label: "Sarabun หนามาก", weight: 700 },
] as const;

export const MAX_FIELD_TEXT = 200;
export const MIN_SIZE = 8;
export const MAX_SIZE = 200;

const DEFAULTS: Record<FieldKey, Omit<CertField, "key">> = {
  name: { enabled: true, text: "{name}", x: 10, y: 46, w: 80, size: 54, color: "#1a1a1a", align: "center", font: "sarabun-700" },
  number: { enabled: true, text: "เลขที่ {number}", x: 60, y: 8, w: 32, size: 20, color: "#333333", align: "right", font: "sarabun-500" },
  date: { enabled: true, text: "ให้ไว้ ณ วันที่ {date}", x: 10, y: 84, w: 80, size: 22, color: "#333333", align: "center", font: "sarabun-400" },
  course: { enabled: true, text: "{course}", x: 10, y: 62, w: 80, size: 32, color: "#0b2a6f", align: "center", font: "sarabun-600" },
  type: { enabled: false, text: "ผ่านการอบรม", x: 10, y: 36, w: 80, size: 26, color: "#333333", align: "center", font: "sarabun-500" },
  award: { enabled: false, text: "ผลคะแนนสอบ {score}%", x: 10, y: 72, w: 80, size: 22, color: "#333333", align: "center", font: "sarabun-400" },
  extra: { enabled: false, text: "", x: 10, y: 92, w: 80, size: 18, color: "#555555", align: "center", font: "sarabun-400" },
};

export const defaultFields = (): CertField[] => FIELD_KEYS.map((key) => ({ key, ...DEFAULTS[key] }));

const num = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 100) / 100)) : fallback;
};
const HEX = /^#[0-9a-fA-F]{6}$/;
export const FONT_KEY = /^(sarabun-(400|500|600|700)|f:[A-Za-z0-9_-]{1,40})$/;

/** Anything saved (or typed in a form) → a complete, safe list of the 7 fields in a fixed order. Unknown keys are dropped, bad values fall back to the defaults. */
export function parseFields(raw: unknown): CertField[] {
  const list = Array.isArray(raw) ? raw : [];
  return FIELD_KEYS.map((key) => {
    const d = DEFAULTS[key];
    const f = (list.find((x) => x && typeof x === "object" && (x as { key?: unknown }).key === key) ?? {}) as Record<string, unknown>;
    return {
      key,
      enabled: typeof f.enabled === "boolean" ? f.enabled : d.enabled,
      text: typeof f.text === "string" ? f.text.slice(0, MAX_FIELD_TEXT) : d.text,
      x: num(f.x, 0, 100, d.x),
      y: num(f.y, 0, 100, d.y),
      w: num(f.w, 1, 100, d.w),
      size: num(f.size, MIN_SIZE, MAX_SIZE, d.size),
      color: typeof f.color === "string" && HEX.test(f.color) ? f.color.toLowerCase() : d.color,
      align: f.align === "left" || f.align === "right" || f.align === "center" ? f.align : d.align,
      font: typeof f.font === "string" && FONT_KEY.test(f.font) ? f.font : d.font,
    };
  });
}

/** Replace {tokens}; an unknown {word} is left as typed so a typo is visible in the preview. */
export function renderTemplate(text: string, values: Partial<CertValues>): string {
  return text.replace(/\{([a-z]+)\}/g, (all, k: string) => (k in values ? (values as Record<string, string>)[k] ?? "" : all)).replace(/[ \t]+/g, " ").trim();
}

/** The values a certificate is drawn with. `completedAt`/`issuedAt` are real instants, shown as long Thai dates (พ.ศ.). */
export function certValues(i: {
  name: string; number: string | null; completedAt: Date; issuedAt: Date | null; course: string; scorePercent: number | null;
  hours: number | null; instructor: string | null; school: string | null; code: string;
}): CertValues {
  return {
    name: i.name,
    number: i.number ?? "",
    date: formatThaiDate(i.completedAt, { style: "long" }),
    issued: i.issuedAt ? formatThaiDate(i.issuedAt, { style: "long" }) : "",
    course: i.course,
    score: i.scorePercent === null ? "" : String(i.scorePercent),
    hours: i.hours === null ? "" : String(i.hours),
    instructor: i.instructor ?? "",
    school: i.school ?? "",
    code: i.code,
  };
}

// ---------- running numbers ----------

export const MAX_PATTERN = 40;

/** A pattern needs {no}; {year} (พ.ศ.) is optional; any other {word} is refused. Returns a Thai message, or null when fine. */
export function patternProblem(pattern: string): string | null {
  const p = pattern.trim();
  if (!p) return "กรอกรูปแบบเลข";
  if (p.length > MAX_PATTERN) return `รูปแบบเลขยาวเกิน ${MAX_PATTERN} ตัวอักษร`;
  if (!p.includes("{no}")) return "รูปแบบเลขต้องมี {no} (เลขลำดับ)";
  const bad = (p.match(/\{[^}]*\}/g) ?? []).find((t) => t !== "{no}" && t !== "{year}");
  if (bad) return `ไม่รู้จัก ${bad} — ใช้ได้เฉพาะ {no} และ {year}`;
  if (/[{}]/.test(p.replace(/\{(no|year)\}/g, ""))) return "มีวงเล็บปีกกาที่ไม่สมบูรณ์";
  return null;
}

export const formatSerialNumber = (pattern: string, no: number, padding: number, beYear: number) =>
  pattern.replace("{no}", String(no).padStart(Math.min(8, Math.max(1, padding)), "0")).replace("{year}", String(beYear));

export type SerialState = { pattern: string; padding: number; nextNo: number; resetYearly: boolean; lastYear: number | null };

/** The number to hand out now, and the series' state afterwards (restarts at 1 when the พ.ศ. changes and resetYearly is on). */
export function takeNumber(s: SerialState, now: Date): { number: string; no: number; year: number; next: SerialState } {
  const year = toBE(bangkokParts(now).year);
  const restart = s.resetYearly && s.lastYear !== null && s.lastYear !== year;
  const no = restart ? 1 : s.nextNo;
  return { number: formatSerialNumber(s.pattern, no, s.padding, year), no, year, next: { ...s, nextNo: no + 1, lastYear: year } };
}

// ---------- designs ----------

export type DesignLite = { id: string; isDefault: boolean; minScore: number | null; position: number };

/**
 * Which design a learner gets: the highest `minScore` they reach; otherwise the default (or, failing that, the first
 * one with no condition, then the first of all). Null only when the course has no design yet.
 */
export function pickDesign<T extends DesignLite>(designs: T[], score: number | null): T | null {
  if (designs.length === 0) return null;
  const byOrder = [...designs].sort((a, b) => a.position - b.position);
  if (score !== null) {
    const hit = byOrder.filter((d) => d.minScore !== null && score >= d.minScore).sort((a, b) => (b.minScore ?? 0) - (a.minScore ?? 0))[0];
    if (hit) return hit;
  }
  return byOrder.find((d) => d.isDefault) ?? byOrder.find((d) => d.minScore === null) ?? byOrder[0];
}

export const canDownload = (status: string) => status === "ISSUED";
