"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { readSpreadsheet } from "@/lib/excel";
import { assertRole, isAdmin } from "@/lib/permissions";
import { mapUserHeaders, validateUserRows } from "@/lib/users-import";
import { buildPreviewRows, commitRows, type CommitInput, type CommitOutcome, type PreviewRow } from "@/lib/users-import-db";

export type { CommitInput, CommitOutcome, PreviewRow };

export type PreviewResult =
  | { ok: false; error: string }
  | { ok: true; fileName: string; rows: PreviewRow[]; counts: { total: number; new: number; update: number; same: number; error: number; warnings: number; passwords: number } };

// Step 1: read the spreadsheet and show what would happen (nothing is saved)
export async function previewUserImport(formData: FormData): Promise<PreviewResult> {
  await assertRole(isAdmin);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "กรุณาเลือกไฟล์ .xlsx หรือ .csv" };

  let sheet;
  try {
    sheet = await readSpreadsheet(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "อ่านไฟล์ไม่ได้" };
  }

  let headerAt = -1;
  let map = mapUserHeaders([]);
  for (let i = 0; i < Math.min(5, sheet.rows.length); i++) {
    const m = mapUserHeaders(sheet.rows[i]);
    if (m.missing.length === 0) { headerAt = i; map = m; break; }
    if (headerAt < 0 && Object.keys(m.index).length > Object.keys(map.index).length) map = m;
  }
  if (headerAt < 0) return { ok: false, error: `ไม่พบหัวคอลัมน์ที่จำเป็น: ${map.missing.join(", ")} — ดาวน์โหลดแม่แบบเพื่อดูรูปแบบที่ถูกต้อง` };

  const schools = await db.school.findMany({ select: { id: true, code: true, name: true } });
  const parsed = validateUserRows(sheet.rows.slice(headerAt + 1), map.index, schools, headerAt + 2);
  if (parsed.length === 0) return { ok: false, error: "ไม่พบแถวข้อมูล" };

  const rows = await buildPreviewRows(parsed);
  const count = (a: PreviewRow["action"]) => rows.filter((r) => r.action === a).length;
  return {
    ok: true,
    fileName: file.name,
    rows,
    counts: { total: rows.length, new: count("new"), update: count("update"), same: count("same"), error: count("error"), warnings: rows.filter((r) => r.action !== "error" && r.warnings.length > 0).length, passwords: rows.filter((r) => r.action === "new" && r.passwordPlan === "generate").length },
  };
}

// Step 2: save, a small chunk at a time (keeps every request short on serverless hosts)
export async function commitUserChunk(inputs: CommitInput[], options: { resetPasswords: boolean }): Promise<{ ok: boolean; error?: string; outcomes: CommitOutcome[] }> {
  await assertRole(isAdmin);
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 40) return { ok: false, error: "ข้อมูลไม่ถูกต้อง", outcomes: [] };
  const outcomes = await commitRows(inputs, !!options.resetPasswords);
  revalidatePath("/admin/users");
  return { ok: true, outcomes };
}

export async function finishUserImport(summary: { fileName: string; created: number; updated: number; unchanged: number; failed: number; passwordsIssued: number }) {
  const actor = await assertRole(isAdmin);
  await audit({ actorId: actor.id, action: "user.import", entity: "User", meta: summary });
  revalidatePath("/admin/users");
}
