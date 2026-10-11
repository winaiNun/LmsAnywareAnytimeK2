/**
 * Text clean-up used when comparing a typed answer with the accepted ones. Thai-friendly: Thai digits equal Arabic digits,
 * zero-width characters and stray spaces do not matter, and (unless asked otherwise) upper/lower case does not matter.
 */
const ZERO_WIDTH = /[​-‍⁠﻿]/g;
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

export function toArabicDigits(s: string): string {
  return s.replace(/[๐-๙]/g, (ch) => String(THAI_DIGITS.indexOf(ch)));
}

export function normaliseText(s: string, opts: { ignoreSpaces?: boolean; caseSensitive?: boolean } = {}): string {
  let t = toArabicDigits(String(s ?? "").normalize("NFC")).replace(ZERO_WIDTH, "").replace(/\s+/g, " ").trim();
  if (!opts.caseSensitive) t = t.toLowerCase();
  if (opts.ignoreSpaces) t = t.replace(/ /g, "");
  return t;
}

/** "1,250.5", "๑๒๓", "−3" -> number; anything that is not a plain number -> null. */
export function parseNumber(s: string): number | null {
  const t = toArabicDigits(String(s ?? "").normalize("NFC")).replace(ZERO_WIDTH, "").replace(/[\s,]/g, "").replace(/[−–—]/g, "-");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
