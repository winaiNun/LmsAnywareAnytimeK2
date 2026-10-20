"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { assertRole, isAdmin, isManager } from "@/lib/permissions";

export type HonorsAdminState = { error?: string; saved?: boolean } | undefined;

const settingsSchema = z.object({ honorsMinItems: z.coerce.number().int().min(1, "ต้องไม่น้อยกว่า 1").max(100, "ไม่เกิน 100") });

/** Honours on/off for the whole system and the minimum work needed to be ranked. Admin only. */
export async function saveHonorsSettings(_prev: HonorsAdminState, f: FormData): Promise<HonorsAdminState> {
  const actor = await assertRole(isAdmin);
  const p = settingsSchema.safeParse(Object.fromEntries(f));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const data = { honorsEnabled: f.get("honorsEnabled") === "on", honorsMinItems: p.data.honorsMinItems };
  await db.siteSetting.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });
  await audit({ actorId: actor.id, action: "honors.settings", entity: "SiteSetting", entityId: "main", meta: data });
  revalidateTag("honors");
  revalidatePath("/", "layout");
  revalidatePath("/honors");
  return { saved: true };
}

/** Take a member off the honours pages (or put them back). They keep their own choice; this is only the admin's override. */
export async function setHonorsHidden(userId: string, hidden: boolean): Promise<{ error?: string }> {
  const actor = await assertRole(isManager);
  const r = await db.user.updateMany({ where: { id: userId }, data: { honorsHidden: hidden } });
  if (!r.count) return { error: "ไม่พบสมาชิก" };
  await audit({ actorId: actor.id, action: hidden ? "honors.hide" : "honors.unhide", entity: "User", entityId: userId });
  revalidateTag("honors");
  revalidatePath("/honors");
  revalidatePath("/admin/honors");
  revalidatePath("/");
  return {};
}
