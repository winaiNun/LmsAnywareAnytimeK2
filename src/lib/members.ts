import { z } from "zod";

export const MEMBER_TYPES = ["STUDENT", "TEACHER", "SUPERVISOR", "GENERAL"] as const;
export type MemberTypeKey = (typeof MEMBER_TYPES)[number];

export const MEMBER_TYPE_LABEL: Record<MemberTypeKey, string> = {
  STUDENT: "นักเรียน",
  TEACHER: "ครู",
  SUPERVISOR: "ศึกษานิเทศก์",
  GENERAL: "บุคคลทั่วไป",
};

export const PREFIXES = ["เด็กชาย", "เด็กหญิง", "นาย", "นางสาว", "นาง", "ดร.", "ผศ.", "รศ.", "ศ."];

/** Teachers and students belong to a school from the directory; the others name an agency. */
export const needsSchool = (t: MemberTypeKey) => t === "STUDENT" || t === "TEACHER";

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

/** Profile fields shared by self-registration, the admin form and "my profile". No national ID, no address. */
export const profileSchema = z
  .object({
    memberType: z.enum(MEMBER_TYPES),
    prefix: text(30),
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
    name: [p.prefix, p.firstName, p.lastName].filter(Boolean).join(" "),
    phone: p.phone ?? null,
    schoolId: school ? p.schoolId ?? null : null,
    organization: school ? null : p.organization ?? null,
    position: p.memberType === "STUDENT" ? null : p.position ?? null,
    gradeLevel: p.memberType === "STUDENT" ? p.gradeLevel ?? null : null,
  };
}

export const emailField = z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(120);
export const usernameField = z.string().trim().toLowerCase().regex(USERNAME_RE, "ชื่อผู้ใช้ 3–30 ตัว ใช้ a-z 0-9 . _ - เท่านั้น");
