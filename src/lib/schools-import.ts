/**
 * Turning a spreadsheet into validated school rows (pure functions: no imports except the Drive link
 * parser, so they are easy to test). Reading the .xlsx/.csv file itself lives in `src/lib/excel.ts`.
 */
import { parseDriveFileId } from "@/lib/drive";

export type ImportRow = {
  line: number; // spreadsheet row number (header = 1)
  code: string;
  name: string;
  district: string;
  center: string;
  email: string | null;
  siteUrl: string | null;
  cardSourceUrl: string | null;
  errors: string[]; // the row cannot be imported
  warnings: string[]; // imported, but worth a look
};

export type Field = "code" | "email" | "district" | "center" | "name" | "siteUrl" | "card";

const ALIASES: Record<Field, string[]> = {
  code: ["รหัสโรงเรียน", "รหัส", "code", "schoolcode", "รหัส10หลัก", "รหัส8หลัก"],
  email: ["อีเมล", "อีเมลล์", "email", "e-mail", "mail"],
  district: ["อำเภอ", "district", "amphoe", "amphur"],
  center: ["ศูนย์เครือข่าย", "ศูนย์", "เครือข่าย", "center", "network", "ศูนย์เครือข่ายโรงเรียน"],
  name: ["ชื่อโรงเรียน", "โรงเรียน", "ชื่อ", "name", "schoolname"],
  siteUrl: ["ลิงก์anywhereanytime", "ลิงค์anywhereanytime", "ลิงก์anywhere", "ลิงก์เว็บไซต์", "ลิงค์เว็บไซต์", "เว็บไซต์", "เว็บ", "ลิงก์", "ลิงค์", "url", "website", "link", "site"],
  card: ["ลิงก์การ์ด", "ลิงค์การ์ด", "การ์ด", "card", "cardlink", "cardurl"],
};

export const FIELD_LABELS: Record<Field, string> = {
  code: "รหัสโรงเรียน",
  email: "อีเมล",
  district: "อำเภอ",
  center: "ศูนย์เครือข่าย",
  name: "ชื่อโรงเรียน",
  siteUrl: "ลิงก์ Anywhere Anytime",
  card: "ลิงก์การ์ด",
};
const REQUIRED: Field[] = ["code", "name", "district", "center"];

const squash = (h: string) => h.toLowerCase().replace(/[\s:：_\-.()（）"']/g, "");

/** Which column holds which field (tolerant of spacing/case/spelling variants of the Thai headers). */
export function mapHeaders(header: string[]): { index: Partial<Record<Field, number>>; missing: Field[] } {
  const index: Partial<Record<Field, number>> = {};
  const heads = header.map((h) => squash(String(h ?? "")));
  const taken = new Set<number>();

  // exact alias match first, then "contains" for the free-form link headers
  for (const field of Object.keys(ALIASES) as Field[]) {
    const at = heads.findIndex((h, i) => !taken.has(i) && ALIASES[field].some((a) => squash(a) === h));
    if (at >= 0) { index[field] = at; taken.add(at); }
  }
  if (index.card === undefined) {
    const at = heads.findIndex((h, i) => !taken.has(i) && (h.includes("การ์ด") || h.includes("card")));
    if (at >= 0) { index.card = at; taken.add(at); }
  }
  if (index.siteUrl === undefined) {
    const at = heads.findIndex((h, i) => !taken.has(i) && (h.includes("anywhere") || h.includes("เว็บ") || h.includes("ลิงก์") || h.includes("ลิงค์")));
    if (at >= 0) { index.siteUrl = at; taken.add(at); }
  }
  return { index, missing: REQUIRED.filter((f) => index[f] === undefined) };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanUrl(raw: string): { url: string | null; note?: "none" | "invalid" } {
  const t = raw.trim();
  if (!t || /^[-–—]+$/.test(t) || !/^https?:\/\//i.test(t)) return { url: null, note: t ? "none" : undefined };
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { url: null, note: "invalid" };
    return { url: u.toString() === t || u.toString() === t + "/" ? t : t };
  } catch {
    return { url: null, note: "invalid" };
  }
}

/** Validate every data row. `rows` excludes the header; `firstLine` is the spreadsheet row of rows[0]. */
export function validateRows(rows: string[][], index: Partial<Record<Field, number>>, firstLine = 2): ImportRow[] {
  const get = (r: string[], f: Field) => (index[f] === undefined ? "" : String(r[index[f]!] ?? "").trim());
  const out: ImportRow[] = [];
  const codeSeen = new Map<string, number>();
  const emailSeen = new Map<string, number>();
  const siteSeen = new Map<string, string>();

  rows.forEach((r, i) => {
    if (r.every((c) => !String(c ?? "").trim())) return; // blank row
    const line = firstLine + i;
    const errors: string[] = [];
    const warnings: string[] = [];

    const code = get(r, "code").replace(/\.0+$/, "");
    const name = get(r, "name").replace(/\s+/g, " ");
    const district = get(r, "district");
    const center = get(r, "center");
    const emailRaw = get(r, "email").toLowerCase();

    if (!code) errors.push("ไม่มีรหัสโรงเรียน");
    else if (!/^\d{4,12}$/.test(code)) errors.push("รหัสโรงเรียนต้องเป็นตัวเลข 4–12 หลัก");
    else if (codeSeen.has(code)) errors.push(`รหัสโรงเรียนซ้ำกับแถว ${codeSeen.get(code)} ในไฟล์`);
    else codeSeen.set(code, line);

    if (!name) errors.push("ไม่มีชื่อโรงเรียน");
    else if (name.length > 150) errors.push("ชื่อโรงเรียนยาวเกิน 150 ตัวอักษร");
    if (!district) errors.push("ไม่มีอำเภอ");
    if (!center) errors.push("ไม่มีศูนย์เครือข่าย");

    let email: string | null = null;
    if (emailRaw) {
      if (!EMAIL.test(emailRaw)) errors.push("รูปแบบอีเมลไม่ถูกต้อง");
      else if (emailSeen.has(emailRaw)) errors.push(`อีเมลซ้ำกับแถว ${emailSeen.get(emailRaw)} ในไฟล์`);
      else { email = emailRaw; emailSeen.set(emailRaw, line); }
    } else {
      warnings.push("ไม่มีอีเมล — จะไม่สร้างบัญชีให้โรงเรียนนี้");
    }

    const site = cleanUrl(get(r, "siteUrl"));
    if (site.note === "invalid") errors.push("ลิงก์ Anywhere Anytime ไม่ถูกต้อง");
    else if (site.note === "none") warnings.push(`ไม่มีลิงก์เว็บไซต์ (“${get(r, "siteUrl").slice(0, 30)}”)`);
    else if (!site.url) warnings.push("ไม่มีลิงก์เว็บไซต์");
    if (site.url) {
      const other = siteSeen.get(site.url);
      if (other) warnings.push(`ลิงก์เว็บไซต์ซ้ำกับรหัส ${other}`);
      else if (code) siteSeen.set(site.url, code);
    }

    const cardRaw = get(r, "card");
    let cardSourceUrl: string | null = null;
    if (cardRaw) {
      if (parseDriveFileId(cardRaw)) cardSourceUrl = cardRaw;
      else warnings.push("ลิงก์การ์ดไม่ใช่ลิงก์ไฟล์จาก Google Drive จึงไม่ดึงภาพ");
    } else warnings.push("ไม่มีลิงก์การ์ด");

    out.push({ line, code, name, district, center, email, siteUrl: site.url, cardSourceUrl, errors, warnings });
  });
  return out;
}

/** Same school name under different codes (legitimately happens across districts): an FYI, not an error. */
export function duplicateNames(rows: ImportRow[]): Map<string, ImportRow[]> {
  const byName = new Map<string, ImportRow[]>();
  for (const r of rows) byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  return new Map([...byName].filter(([, v]) => v.length > 1));
}
