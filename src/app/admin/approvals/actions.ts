"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { assertRole, isManager } from "@/lib/permissions";
import { unlockSignIns } from "@/lib/rate-limit-db";

function refresh() {
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/users");
  revalidatePath("/admin", "layout"); // menu badge
}

/** Training mode on/off: sign-up without a code, every new account waits here for approval. */
export async function setApprovalMode(on: boolean): Promise<{ error?: string }> {
  const actor = await assertRole(isManager);
  await db.siteSetting.upsert({ where: { id: "main" }, update: { registrationApproval: on }, create: { id: "main", registrationApproval: on } });
  await audit({ actorId: actor.id, action: "signup.approval-mode", entity: "SiteSetting", entityId: "main", meta: { on } });
  refresh();
  revalidatePath("/register");
  return {};
}

/** Approve waiting accounts: they can sign in straight away. */
export async function approveUsers(ids: string[]): Promise<{ error?: string; approved?: number }> {
  const actor = await assertRole(isManager);
  const list = ids.filter((x) => typeof x === "string").slice(0, 500);
  if (list.length === 0) return { approved: 0 };
  const r = await db.user.updateMany({ where: { id: { in: list }, pendingApproval: true }, data: { pendingApproval: false, active: true } });
  await Promise.all(list.map((id) => audit({ actorId: actor.id, action: "user.approve", entity: "User", entityId: id })));
  refresh();
  return { approved: r.count };
}

/** Reject = delete the waiting account (it has nothing attached yet: it could never sign in). */
export async function rejectUser(id: string): Promise<{ error?: string }> {
  const actor = await assertRole(isManager);
  const u = await db.user.findFirst({ where: { id, pendingApproval: true }, select: { name: true } });
  if (!u) return { error: "ไม่พบผู้สมัครที่รออนุมัติ (อาจอนุมัติหรือลบไปแล้ว)" };
  await db.user.delete({ where: { id } });
  await audit({ actorId: actor.id, action: "user.reject", entity: "User", entityId: id, meta: { name: u.name } });
  refresh();
  return {};
}

/** Forget every wrong-password / wrong-code / sign-up counter: unlocks a training room that hit a limit. */
export async function unlockAll(): Promise<{ error?: string; cleared?: number }> {
  const actor = await assertRole(isManager);
  const cleared = await unlockSignIns();
  await audit({ actorId: actor.id, action: "signin.unlock", entity: "RateLimitHit", entityId: "all", meta: { cleared } });
  refresh();
  return { cleared };
}
