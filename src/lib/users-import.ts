/**
 * Turning a spreadsheet into validated member rows (pure functions, easy to test). Reading the .xlsx/.csv
 * file itself lives in `src/lib/excel.ts`; matching against the database happens in the server action.
 */
import { MEMBER_TYPES, USERNAME_RE, needsSchool, profileSchema, type MemberTypeKey, AUTO_PREFIXES } from "@/lib/members";

export type UserField = "username" | "email" | "prefix" | "firstName" | "lastName" | "fullName" | "memberType" | "school" | "posGrade" | "password";

export type SchoolRef = { id: string; code: string; name: string };

export type UserImportRow = {
  line: number; // spreadsheet row number (header = 1)
  username: string | null;
  email: string | null;
  prefix: string | null;
  firstName: string;
  lastName: string;
  memberType: MemberTypeKey | null;
  schoolId: string | null; // resolved from the school directory (students / teachers)
  schoolLabel: string; // what the file said, for the preview
  organization: string | null; // supervisors / general: free text
  position: string | null; // teachers etc.
  gradeLevel: string | null; // students
  password: string | null; // typed in the file (optional)
  errors: string[];
  warnings: string[];
};

const ALIASES: Record<UserField, string[]> = {
  username: ["ชื่อผู้ใช้", "ผู้ใช้", "username", "user", "userid", "รหัสประจำตัว", "รหัสนักเรียน", "รหัสประจำตัวนักเรียน", "เลขประจำตัว", "รหัส"],
  email: ["อีเมล", "อีเมลล์", "email", "e-mail", "mail"],
  prefix: ["คำนำหน้า", "คำนำหน้าชื่อ", "prefix", "title"],
  firstName: ["ชื่อ", "ชื่อจริง", "firstname", "first"],
  lastName: ["นามสกุล", "สกุล", "lastname", "last", "surname"],
  fullName: ["ชื่อนามสกุล", "ชื่อสกุล", "ชื่อ-นามสกุล", "ชื่อ-สกุล", "fullname", "name"],
  memberType: ["ประเภท", "ประเภทสมาชิก", "ประเภทผู้ใช้", "type", "membertype"],
  school: ["โรงเรียน", "ชื่อโรงเรียน", "รหัสโรงเรียน", "สังกัด", "หน่วยงาน", "school", "organization"],
  posGrade: ["ตำแหน่งชั้น", "ตำแหน่ง", "ชั้น", "ระดับชั้น", "ตำแหน่ง/ชั้น", "position", "grade", "class"],
  password: ["รหัสผ่าน", "รหัสผ่านเริ่มต้น", "password", "pass", "pwd"],
};

export const USER_FIELD_LABELS: Record<UserField, string> = {
  username: "ชื่อผู้ใช้/รหัสประจำตัว",
  email: "อีเมล",
  prefix: "คำนำหน้า",
  firstName: "ชื่อ",
  lastName: "นามสกุล",
  fullName: "ชื่อ-นามสกุล",
  memberType: "ประเภท",
  school: "โรงเรียน/หน่วยงาน",
  posGrade: "ตำแหน่ง/ชั้น",
  password: "รหัสผ่าน",
};

const squash = (h: string) => h.toLowerCase().replace(/[\s:：_\-.()（）/"']/g, "");

/** Which column holds which field (tolerant of spacing/case/spelling variants of the Thai headers). */
export function mapUserHeaders(header: string[]): { index: Partial<Record<UserField, number>>; missing: string[] } {
  const index: Partial<Record<UserField, number>> = {};
  // "ชื่อผู้ใช้/รหัสประจำตัว" counts as both of its halves
  const heads = header.map((h) => [squash(String(h ?? "")), ...String(h ?? "").split(/[/|]/).map(squash)]);
  const taken = new Set<number>();
  // most specific fields first so "ชื่อ-นามสกุล" is not mistaken for "ชื่อ"
  const order: UserField[] = ["fullName", "username", "email", "prefix", "firstName", "lastName", "memberType", "school", "posGrade", "password"];
  for (const f of order) {
    const at = heads.findIndex((h, i) => !taken.has(i) && ALIASES[f].some((a) => h.includes(squash(a))));
    if (at >= 0) { index[f] = at; taken.add(at); }
  }
  const missing: string[] = [];
  if (index.username === undefined && index.email === undefined) missing.push("ชื่อผู้ใช้ หรือ อีเมล");
  if (index.fullName === undefined && (index.firstName === undefined || index.lastName === undefined)) missing.push("ชื่อ และ นามสกุล (หรือ ชื่อ-นามสกุล)");
  if (index.memberType === undefined) missing.push("ประเภท");
  return { index, missing };
}

/** Thai / English wording people use for the member types. */
export function parseMemberType(raw: string): MemberTypeKey | null {
  const t = raw.toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  if ((MEMBER_TYPES as readonly string[]).includes(raw.trim().toUpperCase())) return raw.trim().toUpperCase() as MemberTypeKey;
  if (/นักเรียน|นักศึกษา|student/.test(t)) return "STUDENT";
  if (/ศึกษานิเทศก์|ศน\.?$|supervisor/.test(t)) return "SUPERVISOR";
  if (/ครู|บุคลากร|teacher|staff/.test(t)) return "TEACHER";
  if (/บุคคลทั่วไป|ทั่วไป|บุคคลภายนอก|ภายนอก|general/.test(t)) return "GENERAL";
  return null;
}

const SCHOOL_WORD = /^(โรงเรียน|รร\.?)\s*/;
const normSchool = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase().replace(SCHOOL_WORD, "");

/** Find a school by its code or its name. Returns "ambiguous" when two schools share the name. */
export function resolveSchool(text: string, schools: SchoolRef[]): SchoolRef | "ambiguous" | null {
  const t = text.trim().replace(/\.0+$/, "");
  if (!t) return null;
  const byCode = schools.find((s) => s.code === t);
  if (byCode) return byCode;
  const n = normSchool(t);
  const hits = schools.filter((s) => normSchool(s.name) === n);
  return hits.length === 1 ? hits[0] : hits.length > 1 ? "ambiguous" : null;
}

/** "นางสาวสมหญิง ใจดี" → prefix + first + last. Prefixes are matched longest first. */
export function splitFullName(full: string): { prefix: string | null; first: string; last: string } {
  let rest = full.replace(/\s+/g, " ").trim();
  let prefix: string | null = null;
  for (const p of [...AUTO_PREFIXES].sort((a, b) => b.length - a.length)) {
    if (rest.startsWith(p)) { prefix = p; rest = rest.slice(p.length).trim(); break; }
  }
  const at = rest.indexOf(" ");
  return at < 0 ? { prefix, first: rest, last: "" } : { prefix, first: rest.slice(0, at), last: rest.slice(at + 1).trim() };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate every data row. `rows` excludes the header; `firstLine` is the spreadsheet row of rows[0]. */
export function validateUserRows(rows: string[][], index: Partial<Record<UserField, number>>, schools: SchoolRef[], firstLine = 2): UserImportRow[] {
  const get = (r: string[], f: UserField) => (index[f] === undefined ? "" : String(r[index[f]!] ?? "").trim());
  const out: UserImportRow[] = [];
  const userSeen = new Map<string, number>();
  const emailSeen = new Map<string, number>();

  rows.forEach((r, i) => {
    if (r.every((c) => !String(c ?? "").trim())) return;
    const line = firstLine + i;
    const errors: string[] = [];
    const warnings: string[] = [];

    // names
    let prefix = get(r, "prefix") || null;
    let firstName = get(r, "firstName");
    let lastName = get(r, "lastName");
    if ((!firstName || !lastName) && get(r, "fullName")) {
      const s = splitFullName(get(r, "fullName"));
      prefix = prefix ?? s.prefix;
      firstName = firstName || s.first;
      lastName = lastName || s.last;
    }
    if (!firstName) errors.push("ไม่มีชื่อ");
    if (!lastName) errors.push("ไม่มีนามสกุล");

    // login names
    let username: string | null = get(r, "username").toLowerCase().replace(/\.0+$/, "").replace(/\s+/g, "") || null;
    if (username && !USERNAME_RE.test(username)) { errors.push("ชื่อผู้ใช้ต้อง 3–30 ตัว ใช้ a-z 0-9 . _ - เท่านั้น"); username = null; }
    let email: string | null = get(r, "email").toLowerCase() || null;
    if (email && !EMAIL.test(email)) { errors.push("รูปแบบอีเมลไม่ถูกต้อง"); email = null; }
    if (!username && !email && !errors.some((e) => e.startsWith("ชื่อผู้ใช้") || e.startsWith("รูปแบบอีเมล"))) errors.push("ต้องมีชื่อผู้ใช้หรืออีเมลอย่างน้อยหนึ่งอย่าง");
    if (username) {
      if (userSeen.has(username)) errors.push(`ชื่อผู้ใช้ซ้ำกับแถว ${userSeen.get(username)} ในไฟล์`);
      else userSeen.set(username, line);
    }
    if (email) {
      if (emailSeen.has(email)) errors.push(`อีเมลซ้ำกับแถว ${emailSeen.get(email)} ในไฟล์`);
      else emailSeen.set(email, line);
    }

    // type + school
    const typeRaw = get(r, "memberType");
    const memberType = parseMemberType(typeRaw);
    if (!typeRaw) errors.push("ไม่ระบุประเภท");
    else if (!memberType) errors.push(`ประเภท “${typeRaw.slice(0, 20)}” ไม่รู้จัก (ใช้: นักเรียน, ครู, ศึกษานิเทศก์, บุคคลทั่วไป)`);

    const schoolText = get(r, "school");
    let schoolId: string | null = null;
    let organization: string | null = null;
    if (memberType && needsSchool(memberType)) {
      if (!schoolText) errors.push("ไม่ระบุโรงเรียน");
      else {
        const s = resolveSchool(schoolText, schools);
        if (s === "ambiguous") errors.push(`มีโรงเรียนชื่อ “${schoolText.slice(0, 30)}” มากกว่าหนึ่งแห่ง — ใช้รหัสโรงเรียนแทน`);
        else if (!s) errors.push(`ไม่พบโรงเรียน “${schoolText.slice(0, 30)}” ในทำเนียบ`);
        else schoolId = s.id;
      }
    } else if (memberType) {
      organization = schoolText || null;
      if (memberType === "SUPERVISOR" && !organization) errors.push("ศึกษานิเทศก์ต้องระบุหน่วยงาน");
    }

    const posGrade = get(r, "posGrade") || null;
    const password = get(r, "password") || null;
    if (password && (password.length < 8 || password.length > 100)) errors.push("รหัสผ่านในไฟล์ต้องยาว 8–100 ตัว (หรือเว้นว่างให้ระบบสร้างให้)");

    const row: UserImportRow = {
      line, username, email, prefix, firstName, lastName, memberType, schoolId,
      schoolLabel: schoolText,
      organization,
      position: memberType === "STUDENT" ? null : posGrade,
      gradeLevel: memberType === "STUDENT" ? posGrade : null,
      password, errors, warnings,
    };

    // the same rules the sign-up form uses (lengths, school required, ...)
    if (memberType && !errors.length) {
      const p = profileSchema.safeParse({ memberType, prefix: prefix ?? undefined, firstName, lastName, schoolId: schoolId ?? undefined, organization: organization ?? undefined, position: row.position ?? undefined, gradeLevel: row.gradeLevel ?? undefined });
      if (!p.success) row.errors.push(p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
    }
    if (!email && memberType === "TEACHER") row.warnings.push("ไม่มีอีเมล — ลืมรหัสผ่านต้องให้แอดมินออกรหัสใหม่");
    out.push(row);
  });
  return out;
}
