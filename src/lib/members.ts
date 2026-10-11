import { z } from "zod";

export const MEMBER_TYPES = ["STUDENT", "TEACHER", "SUPERVISOR", "GENERAL"] as const;
export type MemberTypeKey = (typeof MEMBER_TYPES)[number];

export const MEMBER_TYPE_LABEL: Record<MemberTypeKey, string> = {
  STUDENT: "นักเรียน",
  TEACHER: "ครู",
  SUPERVISOR: "ศึกษานิเทศก์",
  GENERAL: "บุคคลทั่วไป",
};

/**
 * Titles offered in the drop-down, grouped. Anyone whose title is not here picks "อื่นๆ" and types it (profileSchema accepts any
 * Thai/English text up to 30 characters). `auto` = safe to recognise at the start of a full name in an import file (dotted
 * abbreviations and the long forms); plain words like "คุณ" or "พระ" could be the start of a real name, so they are not guessed.
 */
export const PREFIX_GROUPS: { label: string; items: { value: string; auto: boolean }[] }[] = [
  { label: "ทั่วไป", items: ["เด็กชาย", "เด็กหญิง", "ด.ช.", "ด.ญ.", "นาย", "นางสาว", "นาง"].map((value) => ({ value, auto: true })).concat([{ value: "คุณ", auto: false }]) },
  { label: "วิชาการ / วิชาชีพ", items: ["ศ.ดร.", "รศ.ดร.", "ผศ.ดร.", "ศ.", "รศ.", "ผศ.", "ดร.", "นพ.", "พญ.", "ทพ.", "ภก.", "ภญ."].map((value) => ({ value, auto: true })) },
  { label: "ทหาร", items: ["ว่าที่ร้อยตรี", "ว่าที่ร้อยตรีหญิง", "ร.ต.", "ร.ท.", "ร.อ.", "พ.ต.", "พ.ท.", "พ.อ.", "พล.ต.", "พล.ท.", "พล.อ.", "ส.ต.", "ส.ท.", "ส.อ.", "จ.ส.ต.", "จ.ส.ท.", "จ.ส.อ."].map((value) => ({ value, auto: true })) },
  { label: "ตำรวจ", items: ["ด.ต.", "ร.ต.ต.", "ร.ต.ท.", "ร.ต.อ.", "พ.ต.ต.", "พ.ต.ท.", "พ.ต.อ.", "พล.ต.ต.", "พล.ต.ท.", "พล.ต.อ."].map((value) => ({ value, auto: true })) },
  { label: "ศาสนา", items: ["พระ", "พระครู", "พระมหา", "สามเณร"].map((value) => ({ value, auto: false })) },
];

/** Every title in the list. */
export const PREFIXES: string[] = PREFIX_GROUPS.flatMap((g) => g.items.map((i) => i.value));
/** The ones an import may split off the front of "นางสาวสมหญิง ใจดี" (longest first is done by the caller). */
export const AUTO_PREFIXES: string[] = PREFIX_GROUPS.flatMap((g) => g.items.filter((i) => i.auto).map((i) => i.value));

/**
 * The full name as shown anywhere a real name appears (and as printed on certificates): the title is written attached
 * to the first name, with one space between first name and surname: "นายวินัย หนุนกระโทก", "ดร.สมศรี ใจดี".
 * Always build names with this, never by joining the parts with spaces.
 */
export function composePersonName(prefix: string | null | undefined, first: string | null | undefined, last: string | null | undefined): string {
  const f = (first ?? "").replace(/\s+/g, " ").trim();
  const l = (last ?? "").replace(/\s+/g, " ").trim();
  const p = (prefix ?? "").replace(/\s+/g, "");
  return [`${p}${f}`, l].filter(Boolean).join(" ");
}

/** Teachers and students belong to a school from the directory; the others name an agency. */
export const needsSchool = (t: MemberTypeKey) => t === "STUDENT" || t === "TEACHER";

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

/** Profile fields shared by self-registration, the admin form and "my profile". No national ID, no address. */
export const profileSchema = z
  .object({
    memberType: z.enum(MEMBER_TYPES),
    prefix: z
      .string()
      .trim()
      .max(30, "คำนำหน้าไม่เกิน 30 ตัวอักษร")
      .regex(/^[฀-๿A-Za-z.() -]*$/, "คำนำหน้าใช้ได้เฉพาะตัวอักษรไทย/อังกฤษ และเครื่องหมาย . ( ) -")
      .optional()
      .transform((v) => (v ? v : undefined)),
    firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(60),
    lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล").max(60),
    phone: text(20),
    schoolId: text(40),
    organization: text(120),
    position: text(120),
    gradeLevel: text(40),
  })
  .superRefine((v, ctx) => {
    if (needsSchool(v.memberType) && !v.schoolId) ctx.addIssue({ code: "custom", path: ["schoolId"], message: "กรุณาเลือกโรงเรียน" });
    if (v.memberType === "SUPERVISOR" && !v.organization) ctx.addIssue({ code: "custom", path: ["organization"], message: "กรุณากรอกหน่วยงาน" });
    if (v.phone && !/^[0-9+\-\s]{8,20}$/.test(v.phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: "เบอร์โทรไม่ถูกต้อง" });
  });

export type Profile = z.infer<typeof profileSchema>;

/** Fields written to the User row; clears the ones a member type does not use. */
export function profileData(p: Profile) {
  const school = needsSchool(p.memberType);
  return {
    memberType: p.memberType,
    prefix: p.prefix ?? null,
    firstName: p.firstName,
    lastName: p.lastName,
    name: composePersonName(p.prefix, p.firstName, p.lastName),
    phone: p.phone ?? null,
    schoolId: school ? p.schoolId ?? null : null,
    organization: school ? null : p.organization ?? null,
    position: p.memberType === "STUDENT" ? null : p.position ?? null,
    gradeLevel: p.memberType === "STUDENT" ? p.gradeLevel ?? null : null,
  };
}

export const emailField = z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(120);
export const usernameField = z.string().trim().toLowerCase().regex(USERNAME_RE, "ชื่อผู้ใช้ 3–30 ตัว ใช้ a-z 0-9 . _ - เท่านั้น");
