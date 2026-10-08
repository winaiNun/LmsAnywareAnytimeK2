/**
 * Thai (Buddhist Era, พ.ศ.) date helpers used across the whole system.
 *
 * Ground rules — keep to them everywhere:
 *   1. The database and every calculation use real instants (JS Date / ISO strings / Gregorian years).
 *   2. พ.ศ. exists only on screen and in what people type: BE = CE + 543, nothing else ever stores it.
 *   3. "Wall clock" means Asia/Bangkok (UTC+7, no daylight saving). Never use the server's time zone
 *      (Vercel runs in UTC, a dev laptop does not), so none of these functions call getFullYear(),
 *      getMonth(), getDate()... or toLocale*(): they work from the instant plus a fixed +7 offset.
 *
 * This file has no imports, so it is safe in server code, client components and scripts.
 * Tests: `npm run test:dates`.
 */

export const BE_OFFSET = 543;
export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Years outside this range are rejected: it keeps typos out and avoids Date.UTC's 0-99 → 19xx quirk. */
export const MIN_CE_YEAR = 1900;
export const MAX_CE_YEAR = 2200;

export const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"] as const;
export const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."] as const;
export const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"] as const;
export const THAI_WEEKDAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."] as const;

export const toBE = (ceYear: number) => ceYear + BE_OFFSET;
export const toCE = (beYear: number) => beYear - BE_OFFSET;

/** Calendar parts of a Bangkok wall-clock time. `year` is always CE (Gregorian); use toBE() to display. */
export type DateParts = { year: number; month: number; day: number; hour: number; minute: number };

export const isLeapYear = (ceYear: number) => (ceYear % 4 === 0 && ceYear % 100 !== 0) || ceYear % 400 === 0;

export function daysInMonth(ceYear: number, month: number): number {
  if (month === 2) return isLeapYear(ceYear) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/** Bangkok wall-clock parts of an instant. */
export function bangkokParts(date: Date): DateParts {
  const t = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), hour: t.getUTCHours(), minute: t.getUTCMinutes() };
}

/** Bangkok wall-clock → instant. Returns null for anything that is not a real date (31 ก.พ., hour 25, year 1800...). */
export function fromBangkokParts(p: { year: number; month: number; day: number; hour?: number; minute?: number }): Date | null {
  const { year, month, day } = p;
  const hour = p.hour ?? 0;
  const minute = p.minute ?? 0;
  if (![year, month, day, hour, minute].every(isInt)) return null;
  if (year < MIN_CE_YEAR || year > MAX_CE_YEAR) return null;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - BANGKOK_OFFSET_MS);
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export type ThaiDateStyle = "long" | "medium" | "numeric";

/**
 * Format an instant for people, in พ.ศ. and Bangkok time.
 *   long    "8 ตุลาคม 2569"      medium  "8 ต.ค. 2569"      numeric  "08/10/2569"
 * `time` appends " 14:30 น."; `weekday` prepends "วันพุธที่ ".
 */
export function formatThaiDate(date: Date | null | undefined, opts: { style?: ThaiDateStyle; time?: boolean; weekday?: boolean } = {}): string {
  if (!date || Number.isNaN(date.getTime())) return "—";
  const { style = "medium", time = false, weekday = false } = opts;
  const p = bangkokParts(date);
  const be = toBE(p.year);
  let out: string;
  if (style === "long") out = `${p.day} ${THAI_MONTHS[p.month - 1]} ${be}`;
  else if (style === "medium") out = `${p.day} ${THAI_MONTHS_SHORT[p.month - 1]} ${be}`;
  else out = `${pad(p.day)}/${pad(p.month)}/${be}`;
  if (weekday) out = `วัน${THAI_WEEKDAYS[bangkokWeekday(date)]}ที่ ${out}`;
  if (time) out += ` ${pad(p.hour)}:${pad(p.minute)} น.`;
  return out;
}

/** 0 = อาทิตย์ … 6 = เสาร์, for the Bangkok calendar day. */
export function bangkokWeekday(date: Date): number {
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).getUTCDay();
}

/** "ต.ค." for an instant (chart labels etc.). */
export const thaiMonthShort = (date: Date) => THAI_MONTHS_SHORT[bangkokParts(date).month - 1];

// ---------------------------------------------------------------------------------------------
// Typing: "8/10/2569", "08-10-69", "8.10.2026", "2569-10-08", optionally followed by " 14:30"
// ---------------------------------------------------------------------------------------------

/**
 * Turn a typed year into a CE year.
 *   4 digits ≥ 2400  → พ.ศ.  (2569 → 2026)
 *   4 digits 1900–2200 → ค.ศ. (2026 stays 2026)
 *   2 digits          → พ.ศ. 25xx (69 → 2569 → 2026), the way Thai people abbreviate
 * Anything else is rejected (null) instead of being guessed.
 */
export function normalizeYear(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  if (raw.length === 2) return toCE(2500 + n);
  if (raw.length !== 4) return null;
  if (n >= 2400) return toCE(n);
  if (n >= MIN_CE_YEAR && n <= MAX_CE_YEAR) return n;
  return null;
}

/** Parse what a person typed. Returns validated Bangkok parts, or null if it is not a real date. */
export function parseThaiDateInput(text: string): (DateParts & { hasTime: boolean }) | null {
  const m = /^\s*(\d{1,4})\s*[/\-.\s]\s*(\d{1,2})\s*[/\-.\s]\s*(\d{1,4})(?:\s+(\d{1,2})[:.](\d{2}))?\s*(?:น\.?)?\s*$/.exec(text);
  if (!m) return null;
  const [, a, b, c, hh, mm] = m;

  // 4-digit first part = year-first (ISO style); otherwise day/month/year
  const yearFirst = a.length === 4;
  const yearRaw = yearFirst ? a : c;
  const month = parseInt(b, 10);
  const day = parseInt(yearFirst ? c : a, 10);
  if (!yearFirst && c.length !== 2 && c.length !== 4) return null;

  const year = normalizeYear(yearRaw);
  if (year === null) return null;
  const hour = hh === undefined ? 0 : parseInt(hh, 10);
  const minute = mm === undefined ? 0 : parseInt(mm, 10);
  if (!fromBangkokParts({ year, month, day, hour, minute })) return null;
  return { year, month, day, hour, minute, hasTime: hh !== undefined };
}

/** How the typed field shows a value: "08/10/2569" or "08/10/2569 14:30". */
export function formatThaiInput(date: Date | null | undefined, withTime: boolean): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const p = bangkokParts(date);
  const day = `${pad(p.day)}/${pad(p.month)}/${toBE(p.year)}`;
  return withTime ? `${day} ${pad(p.hour)}:${pad(p.minute)}` : day;
}

// ---------------------------------------------------------------------------------------------
// Storing / receiving values
// ---------------------------------------------------------------------------------------------

/**
 * Read a date coming from a form or API. Accepts ISO with a zone ("2026-10-08T07:30:00.000Z",
 * "...+07:00") and, for old data, the zone-less "YYYY-MM-DDTHH:mm" which is taken as Bangkok time
 * (NOT the server's). Anything else → null.
 */
export function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const v = value.trim();
  const local = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/.exec(v);
  if (local) {
    return fromBangkokParts({ year: +local[1], month: +local[2], day: +local[3], hour: local[4] ? +local[4] : 0, minute: local[5] ? +local[5] : 0 });
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v)) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  return y < MIN_CE_YEAR || y > MAX_CE_YEAR ? null : d;
}

// ---------------------------------------------------------------------------------------------
// Calculations (deadlines, loan due dates, course durations, charts)
// ---------------------------------------------------------------------------------------------

/** 00:00 Bangkok of the day the instant falls on. */
export function startOfDayBangkok(date: Date): Date {
  const p = bangkokParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - BANGKOK_OFFSET_MS);
}

/** 23:59:59.999 Bangkok of that day — use for "valid until the end of this date". */
export function endOfDayBangkok(date: Date): Date {
  return new Date(startOfDayBangkok(date).getTime() + DAY_MS - 1);
}

/** Add whole calendar days, keeping the Bangkok wall-clock time (Thailand has no DST). */
export function addDaysBangkok(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Add calendar months in Bangkok; the day is clamped (31 ม.ค. + 1 เดือน = 28/29 ก.พ.). */
export function addMonthsBangkok(date: Date, months: number): Date {
  const p = bangkokParts(date);
  const index = p.year * 12 + (p.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12 + 12) % 12 + 1;
  const day = Math.min(p.day, daysInMonth(year, month));
  return new Date(Date.UTC(year, month - 1, day, p.hour, p.minute) - BANGKOK_OFFSET_MS);
}

/** Whole calendar days from a's date to b's date (b later → positive), ignoring the time of day. */
export function diffCalendarDays(a: Date, b: Date): number {
  return Math.round((startOfDayBangkok(b).getTime() - startOfDayBangkok(a).getTime()) / DAY_MS);
}

export const isSameBangkokDay = (a: Date, b: Date) => diffCalendarDays(a, b) === 0;

/** The last `count` calendar months ending with the month of `now` (oldest first), Bangkok calendar. */
export function lastMonthsBangkok(count: number, now: Date = new Date()): { year: number; month: number; start: Date; end: Date }[] {
  const cur = bangkokParts(now);
  return Array.from({ length: count }, (_, i) => {
    const index = cur.year * 12 + (cur.month - 1) - (count - 1 - i);
    const year = Math.floor(index / 12);
    const month = index % 12 + 1;
    const nextIndex = index + 1;
    return {
      year,
      month,
      start: new Date(Date.UTC(year, month - 1, 1) - BANGKOK_OFFSET_MS),
      end: new Date(Date.UTC(Math.floor(nextIndex / 12), nextIndex % 12, 1) - BANGKOK_OFFSET_MS), // exclusive
    };
  });
}

/** Month grid for a calendar popup: 6 rows × 7 columns of {year, month, day, inMonth}, weeks start on Sunday. */
export function monthGrid(ceYear: number, month: number): { year: number; month: number; day: number; inMonth: boolean }[] {
  const first = new Date(Date.UTC(ceYear, month - 1, 1));
  const lead = first.getUTCDay();
  const cells: { year: number; month: number; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(ceYear, month - 1, 1 - lead + i));
    cells.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), inMonth: d.getUTCMonth() === month - 1 });
  }
  return cells;
}
