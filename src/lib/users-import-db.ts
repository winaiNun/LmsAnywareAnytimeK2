/**
 * Database side of the member import (no "use server": the server actions in
 * src/app/admin/users/import/actions.ts check the admin first, then call these).
 */
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL, profileData, type MemberTypeKey } from "@/lib/members";
import { generateTempPassword } from "@/lib/password";
import { validateUserRows, type UserField, type UserImportRow } from "@/lib/users-import";

const BCRYPT_COST = 10; // temporary passwords are random and must be changed at first login

export type PreviewRow = UserImportRow & {
  action: "new" | "update" | "same" | "error";
  changes: string[];
  schoolName: string | null;
  passwordPlan: "file" | "generate" | "keep";
};

export type CommitInput = { username: string | null; email: string | null; prefix: string | null; firstName: string; lastName: string; memberType: string | null; schoolText: string; schoolId: string | null; organization: string | null; position: string | null; gradeLevel: string | null; password: string | null };
export type CommitOutcome = {
  key: string;
  result: "created" | "updated" | "unchanged" | "error";
  error?: string;
  credential?: { login: string; name: string; type: string; password: string };
};

type Existing = { id: string; role: string; username: string | null; email: string | null; memberType: MemberTypeKey; prefix: string | null; firstName: string | null; lastName: string | null; schoolId: string | null; organization: string | null; position: string | null; gradeLevel: string | null; isSchoolAccount: boolean };

const loadSchools = () => db.school.findMany({ select: { id: true, code: true, name: true } });

async function findExisting(rows: UserImportRow[]) {
  const usernames = rows.map((r) => r.username).filter((x): x is string => !!x);
  const emails = rows.map((r) => r.email).filter((x): x is string => !!x);
  const users = await db.user.findMany({
    where: { OR: [{ username: { in: usernames } }, { email: { in: emails } }] },
    select: { id: true, role: true, username: true, email: true, memberType: true, prefix: true, firstName: true, lastName: true, schoolId: true, organization: true, position: true, gradeLevel: true, school: { select: { id: true } } },
  });
  const list: Existing[] = users.map(({ school, ...u }) => ({ ...u, isSchoolAccount: !!school }));
  return { byUsername: new Map(list.filter((u) => u.username).map((u) => [u.username!, u])), byEmail: new Map(list.filter((u) => u.email).map((u) => [u.email!, u])) };
}

/** Which existing account (if any) a row refers to, or an error when username and e-mail point at two different people. */
function match(r: UserImportRow, f: Awaited<ReturnType<typeof findExisting>>): { existing: Existing | null; error?: string } {
  const a = r.username ? f.byUsername.get(r.username) : undefined;
  const b = r.email ? f.byEmail.get(r.email) : undefined;
  if (a && b && a.id !== b.id) return { existing: null, error: "ชื่อผู้ใช้และอีเมลในแถวนี้เป็นของคนละบัญชีที่มีอยู่แล้ว" };
  const u = a ?? b ?? null;
  if (u && (u.role === "ADMIN" || u.role === "LIBRARIAN")) return { existing: u, error: "เป็นบัญชีผู้ดูแล/บรรณารักษ์ — แก้ที่หน้าสมาชิก ไม่แก้ผ่านการนำเข้า" };
  if (u?.isSchoolAccount) return { existing: u, error: "เป็นบัญชีของโรงเรียน — จัดการที่เมนูโรงเรียน" };
  return { existing: u };
}

function diff(r: UserImportRow, u: Existing): string[] {
  const c: string[] = [];
  if (u.memberType !== r.memberType) c.push("ประเภท");
  if ((u.prefix ?? null) !== r.prefix) c.push("คำนำหน้า");
  if ((u.firstName ?? "") !== r.firstName || (u.lastName ?? "") !== r.lastName) c.push("ชื่อ-นามสกุล");
  if ((u.schoolId ?? null) !== r.schoolId) c.push("โรงเรียน");
  if ((u.organization ?? null) !== r.organization) c.push("หน่วยงาน");
  if ((u.position ?? null) !== r.position) c.push("ตำแหน่ง");
  if ((u.gradeLevel ?? null) !== r.gradeLevel) c.push("ชั้น");
  if (r.username && u.username !== r.username) c.push("ชื่อผู้ใช้");
  if (r.email && u.email !== r.email) c.push("อีเมล");
  return c;
}


/** Preview: what would happen to each validated row (nothing is saved). */
export async function buildPreviewRows(parsed: UserImportRow[]): Promise<PreviewRow[]> {
  const schools = await loadSchools();
  const found = await findExisting(parsed);
  const schoolName = new Map(schools.map((s) => [s.id, s.name]));
  return parsed.map((r) => {
    const errors = [...r.errors];
    const m = errors.length ? { existing: null as Existing | null } : match(r, found);
    if ("error" in m && m.error) errors.push(m.error);
    const existing = m.existing;
    const changes = existing && !errors.length ? diff(r, existing) : [];
    const action: PreviewRow["action"] = errors.length ? "error" : !existing ? "new" : changes.length ? "update" : "same";
    return { ...r, errors, action, changes, schoolName: r.schoolId ? schoolName.get(r.schoolId) ?? null : null, passwordPlan: existing ? "keep" : r.password ? "file" : "generate" };
  });
}

/** Save: never trusts the browser, every row is rebuilt through the same validation as the preview. */
export async function commitRows(inputs: CommitInput[], resetPasswords: boolean): Promise<CommitOutcome[]> {
  const schools = await loadSchools();
  const idx: Partial<Record<UserField, number>> = { username: 0, email: 1, prefix: 2, firstName: 3, lastName: 4, memberType: 5, school: 6, posGrade: 7, password: 8 };
  const rows = validateUserRows(
    inputs.map((i) => [i.username ?? "", i.email ?? "", i.prefix ?? "", i.firstName, i.lastName, i.memberType ?? "", i.schoolId ? schools.find((s) => s.id === i.schoolId)?.code ?? i.schoolText : i.organization ?? i.schoolText, i.memberType === "STUDENT" ? i.gradeLevel ?? "" : i.position ?? "", i.password ?? ""]),
    idx, schools, 0,
  );
  const found = await findExisting(rows);
  const outcomes: CommitOutcome[] = [];
  for (const r of rows) {
    const key = r.username ?? r.email ?? `row ${r.line}`;
    if (r.errors.length) { outcomes.push({ key, result: "error", error: r.errors[0] }); continue; }
    const m = match(r, found);
    if (m.error) { outcomes.push({ key, result: "error", error: m.error }); continue; }
    try {
      outcomes.push(await saveOne(r, m.existing, resetPasswords, key));
    } catch (e) {
      console.error("user import row failed", key, e);
      outcomes.push({ key, result: "error", error: "บันทึกไม่สำเร็จ" });
    }
  }
  return outcomes;
}

async function saveOne(r: UserImportRow, existing: Existing | null, resetPassword: boolean, key: string): Promise<CommitOutcome> {
  // The sheet has no phone column: never write phone, so an update can not wipe a number the member typed.
  const profile = profileData({
    memberType: r.memberType!,
    phone: undefined,
    prefix: r.prefix ?? undefined,
    firstName: r.firstName,
    lastName: r.lastName,
    schoolId: r.schoolId ?? undefined,
    organization: r.organization ?? undefined,
    position: r.position ?? undefined,
    gradeLevel: r.gradeLevel ?? undefined,
  });
  delete (profile as { phone?: string | null }).phone;
  const type = MEMBER_TYPE_LABEL[r.memberType!];
  const login = r.username ?? r.email ?? key;

  if (!existing) {
    const password = r.password ?? generateTempPassword();
    await db.user.create({ data: { ...profile, username: r.username, email: r.email, passwordHash: await bcrypt.hash(password, BCRYPT_COST), mustChangePassword: true } });
    return { key, result: "created", credential: r.password ? undefined : { login, name: profile.name, type, password } };
  }

  const changes = diff(r, existing);
  let credential: CommitOutcome["credential"];
  const data: Parameters<typeof db.user.update>[0]["data"] = { ...profile };
  if (r.username) data.username = r.username;
  if (r.email) data.email = r.email;
  if (resetPassword) {
    const password = r.password ?? generateTempPassword();
    data.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    data.mustChangePassword = true;
    credential = { login, name: profile.name, type, password };
  }
  if (!changes.length && !resetPassword) return { key, result: "unchanged" };
  await db.user.update({ where: { id: existing.id }, data });
  if (resetPassword) await db.trustedDevice.deleteMany({ where: { userId: existing.id } }); // PINs set with the old password stop working
  return { key, result: "updated", credential };
}

