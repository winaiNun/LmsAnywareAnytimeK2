"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseDriveFileId } from "@/lib/drive";
import { readSpreadsheet } from "@/lib/excel";
import { generateTempPassword } from "@/lib/password";
import { assertRole, isManager } from "@/lib/permissions";
import { refreshSchoolCard } from "@/lib/school-card";
import { duplicateNames, mapHeaders, validateRows, FIELD_LABELS, type ImportRow } from "@/lib/schools-import";
import { getStorage } from "@/lib/storage";

const BCRYPT_COST = 10; // temporary passwords are random and must be changed at first login

function refresh() {
  revalidatePath("/");
  revalidatePath("/schools");
  revalidatePath("/admin/schools");
}

// --------------------------------------------------------------------------------------------
// Import step 1: read the spreadsheet and show what would happen (nothing is saved)
// --------------------------------------------------------------------------------------------

export type PreviewRow = ImportRow & {
  action: "new" | "update" | "same" | "error";
  account: "create" | "exists" | "none" | "conflict";
  changes: string[]; // human-readable list of fields that will change (updates only)
};

export type PreviewResult =
  | { ok: false; error: string }
  | {
      ok: true;
      fileName: string;
      rows: PreviewRow[];
      counts: { total: number; new: number; update: number; same: number; error: number; accountsToCreate: number; warnings: number };
      duplicateNames: string[];
    };

export async function previewSchoolImport(formData: FormData): Promise<PreviewResult> {
  await assertRole(isManager);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "กรุณาเลือกไฟล์ .xlsx หรือ .csv" };

  let sheet;
  try {
    sheet = await readSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "อ่านไฟล์ไม่ได้" };
  }

  // find the header row: the first of the first 5 rows that names at least the required columns
  let headerAt = -1;
  let map = mapHeaders([]);
  for (let i = 0; i < Math.min(5, sheet.rows.length); i++) {
    const m = mapHeaders(sheet.rows[i]);
    if (m.missing.length === 0) { headerAt = i; map = m; break; }
    if (headerAt < 0 && Object.keys(m.index).length > Object.keys(map.index).length) map = m;
  }
  if (headerAt < 0) {
    const missing = map.missing.map((f) => FIELD_LABELS[f]).join(", ");
    return { ok: false, error: `ไม่พบหัวคอลัมน์ที่จำเป็น: ${missing} — ดาวน์โหลดแม่แบบเพื่อดูรูปแบบที่ถูกต้อง` };
  }

  const parsed = validateRows(sheet.rows.slice(headerAt + 1), map.index, headerAt + 2);
  if (parsed.length === 0) return { ok: false, error: "ไม่พบแถวข้อมูล" };

  const codes = parsed.map((r) => r.code).filter(Boolean);
  const emails = parsed.map((r) => r.email).filter((e): e is string => !!e);
  const [existing, users] = await Promise.all([
    db.school.findMany({ where: { code: { in: codes } }, include: { account: { select: { email: true } } } }),
    db.user.findMany({ where: { email: { in: emails } }, include: { school: { select: { code: true } } } }),
  ]);
  const byCode = new Map(existing.map((s) => [s.code, s]));
  const byEmail = new Map(users.map((u) => [u.email, u]));

  const rows: PreviewRow[] = parsed.map((r) => {
    let account: PreviewRow["account"] = "none";
    const errors = [...r.errors];
    if (r.email) {
      const u = byEmail.get(r.email);
      if (!u) account = "create";
      else if (u.school?.code === r.code) account = "exists";
      else {
        account = "conflict";
        errors.push(u.school ? `อีเมลนี้เป็นบัญชีของโรงเรียนรหัส ${u.school.code} อยู่แล้ว` : "อีเมลนี้เป็นบัญชีผู้ใช้อื่นอยู่แล้ว (ไม่ใช่บัญชีโรงเรียน)");
      }
    }
    const cur = r.code ? byCode.get(r.code) : undefined;
    const changes: string[] = [];
    if (cur) {
      if (cur.name !== r.name) changes.push("ชื่อ");
      if (cur.district !== r.district) changes.push("อำเภอ");
      if (cur.center !== r.center) changes.push("ศูนย์");
      if ((cur.siteUrl ?? null) !== r.siteUrl) changes.push("ลิงก์เว็บไซต์");
      if ((cur.cardSourceUrl ?? null) !== r.cardSourceUrl) changes.push("ลิงก์การ์ด");
      if (r.email && cur.email !== r.email) changes.push("อีเมล");
      if (account === "create") changes.push("สร้างบัญชีผู้ใช้"); // school exists but never got its login account
    }
    const action: PreviewRow["action"] = errors.length ? "error" : !cur ? "new" : changes.length ? "update" : "same";
    return { ...r, errors, action, account, changes };
  });

  const count = (a: PreviewRow["action"]) => rows.filter((r) => r.action === a).length;
  return {
    ok: true,
    fileName: file.name,
    rows,
    counts: {
      total: rows.length,
      new: count("new"),
      update: count("update"),
      same: count("same"),
      error: count("error"),
      accountsToCreate: rows.filter((r) => r.action !== "error" && r.account === "create").length,
      warnings: rows.filter((r) => r.action !== "error" && r.warnings.length > 0).length,
    },
    duplicateNames: [...duplicateNames(rows).keys()],
  };
}

// --------------------------------------------------------------------------------------------
// Import step 2: save, a small chunk at a time (keeps every request short on serverless hosts)
// --------------------------------------------------------------------------------------------

export type CommitInput = { code: string; email: string | null; district: string; center: string; name: string; siteUrl: string | null; cardSourceUrl: string | null };
export type CommitOutcome = {
  code: string;
  result: "created" | "updated" | "unchanged" | "error";
  error?: string;
  credential?: { code: string; name: string; email: string; password: string };
};

const IDX = { code: 0, email: 1, district: 2, center: 3, name: 4, siteUrl: 5, card: 6 } as const;

export async function commitSchoolChunk(inputs: CommitInput[], options: { overwriteLinks: boolean }): Promise<{ ok: boolean; error?: string; outcomes: CommitOutcome[] }> {
  const actor = await assertRole(isManager);
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 50) return { ok: false, error: "ข้อมูลไม่ถูกต้อง", outcomes: [] };

  // Never trust the browser: run every row through the same validation as the preview.
  const rows = validateRows(inputs.map((i) => [i.code, i.email ?? "", i.district, i.center, i.name, i.siteUrl ?? "", i.cardSourceUrl ?? ""]), IDX, 0);
  const outcomes: CommitOutcome[] = [];

  for (const r of rows) {
    if (r.errors.length) { outcomes.push({ code: r.code, result: "error", error: r.errors[0] }); continue; }
    try {
      outcomes.push(await saveOneSchool(r, options.overwriteLinks, actor.id));
    } catch (e) {
      console.error("school import row failed", r.code, e);
      outcomes.push({ code: r.code, result: "error", error: "บันทึกไม่สำเร็จ" });
    }
  }
  refresh();
  return { ok: true, outcomes };
}

async function saveOneSchool(r: ImportRow, overwriteLinks: boolean, actorId: string): Promise<CommitOutcome> {
  const cur = await db.school.findUnique({ where: { code: r.code } });
  let credential: CommitOutcome["credential"];
  let accountId = cur?.accountId ?? null;

  if (r.email && !accountId) {
    const u = await db.user.findUnique({ where: { email: r.email }, include: { school: true } });
    if (u) {
      if (u.school && u.school.code !== r.code) return { code: r.code, result: "error", error: `อีเมลนี้เป็นบัญชีของโรงเรียนรหัส ${u.school.code}` };
      if (!u.school) return { code: r.code, result: "error", error: "อีเมลนี้เป็นบัญชีผู้ใช้อื่นอยู่แล้ว" };
      accountId = u.id;
    } else {
      const password = generateTempPassword();
      const created = await db.user.create({
        data: { email: r.email, name: r.name, passwordHash: await bcrypt.hash(password, BCRYPT_COST), role: "STUDENT", mustChangePassword: true },
      });
      accountId = created.id;
      credential = { code: r.code, name: r.name, email: r.email, password };
    }
  }

  const keepLinks = !!cur && !overwriteLinks;
  const siteUrl = keepLinks && cur.siteUrl ? cur.siteUrl : r.siteUrl;
  const cardSourceUrl = keepLinks && cur.cardSourceUrl ? cur.cardSourceUrl : r.cardSourceUrl;
  const cardChanged = cardSourceUrl !== (cur?.cardSourceUrl ?? null);

  const data = {
    name: r.name,
    district: r.district,
    center: r.center,
    email: r.email ?? cur?.email ?? null,
    siteUrl,
    cardSourceUrl,
    ...(cardChanged ? { cardStatus: cur?.cardKey ? "ok" : "none", cardError: null } : {}),
    accountId,
    updatedById: actorId,
  };

  if (!cur) {
    await db.school.create({ data: { code: r.code, ...data, cardStatus: cardSourceUrl ? "none" : "none" } });
    return { code: r.code, result: "created", credential };
  }
  const same = cur.name === data.name && cur.district === data.district && cur.center === data.center && cur.siteUrl === siteUrl && cur.cardSourceUrl === cardSourceUrl && cur.email === data.email && cur.accountId === accountId;
  if (same) return { code: r.code, result: "unchanged", credential };
  await db.school.update({ where: { id: cur.id }, data });
  return { code: r.code, result: "updated", credential };
}

export async function finishSchoolImport(summary: { fileName: string; created: number; updated: number; unchanged: number; failed: number; accountsCreated: number }) {
  const actor = await assertRole(isManager);
  await audit({ actorId: actor.id, action: "school.import", entity: "School", meta: summary });
  refresh();
}

// --------------------------------------------------------------------------------------------
// Card pictures
// --------------------------------------------------------------------------------------------

/** Ids of schools that have a card link but no picture yet (or whose last fetch failed). */
export async function listCardTodoIds(onlyMissing = true): Promise<string[]> {
  await assertRole(isManager);
  const rows = await db.school.findMany({
    where: { cardSourceUrl: { not: null }, ...(onlyMissing ? { OR: [{ cardKey: null }, { cardStatus: "failed" }] } : {}) },
    select: { id: true },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => r.id);
}

export async function refreshCards(ids: string[]): Promise<{ id: string; ok: boolean; error?: string }[]> {
  await assertRole(isManager);
  if (!Array.isArray(ids) || ids.length > 8) return [];
  const out: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of ids) {
    const r = await refreshSchoolCard(String(id));
    out.push(r.ok ? { id, ok: true } : { id, ok: false, error: r.error });
  }
  refresh();
  return out;
}

// --------------------------------------------------------------------------------------------
// Edit one school (admin)
// --------------------------------------------------------------------------------------------

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\/\S+$/.test(v), "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https:// และห้ามมีช่องว่าง");

const schoolSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อโรงเรียน").max(150),
  district: z.string().trim().min(1, "กรุณากรอกอำเภอ").max(60),
  center: z.string().trim().min(1, "กรุณากรอกศูนย์เครือข่าย").max(60),
  email: z.string().trim().toLowerCase().max(200).optional().transform((v) => v || null).refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "รูปแบบอีเมลไม่ถูกต้อง"),
  siteUrl: optionalUrl,
  cardSourceUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || parseDriveFileId(v) !== null, "ลิงก์การ์ดต้องเป็นลิงก์ไฟล์จาก drive.google.com"),
});

export type SchoolFormState = { error?: string; saved?: boolean } | undefined;

export async function saveSchool(id: string, _prev: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const actor = await assertRole(isManager);
  const parsed = schoolSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const cur = await db.school.findUnique({ where: { id } });
  if (!cur) return { error: "ไม่พบโรงเรียน" };

  // e-mail change also renames the login of the linked account
  if (d.email && d.email !== cur.email) {
    const clash = await db.user.findUnique({ where: { email: d.email }, select: { id: true } });
    if (clash && clash.id !== cur.accountId) return { error: "อีเมลนี้มีผู้ใช้อื่นใช้อยู่แล้ว" };
    if (cur.accountId) await db.user.update({ where: { id: cur.accountId }, data: { email: d.email } });
  }

  await db.school.update({
    where: { id },
    data: {
      ...d,
      active: formData.get("active") === "on",
      updatedById: actor.id,
      ...(d.cardSourceUrl !== cur.cardSourceUrl ? { cardStatus: cur.cardKey ? "ok" : "none", cardError: null } : {}),
    },
  });
  await audit({ actorId: actor.id, action: "school.edit", entity: "School", entityId: id, meta: { by: "admin" } });
  refresh();
  return { saved: true };
}

export async function setSchoolActive(id: string, active: boolean) {
  const actor = await assertRole(isManager);
  await db.school.update({ where: { id }, data: { active, updatedById: actor.id } });
  refresh();
}

export async function deleteSchool(id: string) {
  const actor = await assertRole(isManager);
  const s = await db.school.findUnique({ where: { id } });
  if (!s) return;
  if (s.cardKey) await getStorage().delete(s.cardKey).catch(() => {});
  await db.school.delete({ where: { id } }); // the login account is kept (an admin can deactivate it separately)
  await audit({ actorId: actor.id, action: "school.delete", entity: "School", entityId: id, meta: { code: s.code, name: s.name } });
  refresh();
}

/**
 * New temporary password for the school's account (creates the account first when the school has an
 * e-mail but no account yet). The password is returned ONCE; only its hash is stored.
 */
export async function issueSchoolPassword(id: string): Promise<{ ok: true; email: string; password: string } | { ok: false; error: string }> {
  const actor = await assertRole(isManager);
  const s = await db.school.findUnique({ where: { id } });
  if (!s) return { ok: false, error: "ไม่พบโรงเรียน" };
  if (!s.email) return { ok: false, error: "โรงเรียนนี้ยังไม่มีอีเมล กรุณาเพิ่มอีเมลก่อน" };

  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  if (s.accountId) {
    await db.user.update({ where: { id: s.accountId }, data: { passwordHash, mustChangePassword: true, active: true } });
    await db.trustedDevice.deleteMany({ where: { userId: s.accountId } }); // a reset also signs the old phones out of PIN login
  } else {
    const clash = await db.user.findUnique({ where: { email: s.email } });
    if (clash) return { ok: false, error: "อีเมลนี้มีผู้ใช้อื่นใช้อยู่แล้ว" };
    const u = await db.user.create({ data: { email: s.email, name: s.name, passwordHash, role: "STUDENT", mustChangePassword: true } });
    await db.school.update({ where: { id }, data: { accountId: u.id } });
  }
  await audit({ actorId: actor.id, action: "school.password-reset", entity: "School", entityId: id });
  refresh();
  return { ok: true, email: s.email, password };
}
