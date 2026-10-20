"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { assertRole, isAdmin } from "@/lib/permissions";

/** Mark a problem fixed (it opens again by itself if it happens again) or open it again by hand. */
export async function setErrorResolved(id: string, resolved: boolean): Promise<{ error?: string }> {
  const actor = await assertRole(isAdmin);
  const r = await db.errorLog.updateMany({ where: { id }, data: { resolvedAt: resolved ? new Date() : null } });
  if (!r.count) return { error: "ไม่พบรายการ" };
  await audit({ actorId: actor.id, action: resolved ? "error.resolve" : "error.reopen", entity: "ErrorLog", entityId: id });
  revalidatePath("/admin/errors");
  revalidatePath("/admin");
  return {};
}

/** Clear every problem already marked fixed. */
export async function clearResolvedErrors(): Promise<{ error?: string; removed?: number }> {
  await assertRole(isAdmin);
  const r = await db.errorLog.deleteMany({ where: { resolvedAt: { not: null } } });
  revalidatePath("/admin/errors");
  return { removed: r.count };
}
