"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { DEFAULT_STAT_CARDS, MAX_STAT_CARDS } from "@/lib/stats/metrics";
import { parseCardInput } from "@/lib/stats/validate";
import { assertRole, isManager } from "@/lib/permissions";

export type StatFormState = { error?: string; saved?: boolean } | undefined;

function refresh() {
  revalidateTag("stats");
  revalidatePath("/admin/stat-cards");
  revalidatePath("/");
}

/** Create (id null) or update one card. The metric, label and icon are checked by parseCardInput. */
export async function saveStatCard(id: string | null, _prev: StatFormState, f: FormData): Promise<StatFormState> {
  const actor = await assertRole(isManager);
  const p = parseCardInput(Object.fromEntries(f));
  if (!p.ok) return { error: p.error };
  const data = { metric: p.data.metric, label: p.data.label, icon: p.data.icon, visible: f.get("visible") === "on" };
  if (id) {
    const r = await db.statCard.updateMany({ where: { id }, data });
    if (!r.count) return { error: "ไม่พบการ์ดนี้" };
    await audit({ actorId: actor.id, action: "stat.update", entity: "StatCard", entityId: id, meta: { metric: data.metric } });
  } else {
    if ((await db.statCard.count()) >= MAX_STAT_CARDS) return { error: `มีการ์ดได้ไม่เกิน ${MAX_STAT_CARDS} ใบ กรุณาลบใบที่ไม่ใช้ก่อน` };
    const last = await db.statCard.aggregate({ _max: { sortOrder: true } });
    const row = await db.statCard.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await audit({ actorId: actor.id, action: "stat.create", entity: "StatCard", entityId: row.id, meta: { metric: data.metric } });
  }
  refresh();
  return { saved: true };
}

export async function setStatCardVisible(id: string, visible: boolean) {
  const actor = await assertRole(isManager);
  await db.statCard.updateMany({ where: { id }, data: { visible } });
  await audit({ actorId: actor.id, action: visible ? "stat.show" : "stat.hide", entity: "StatCard", entityId: id });
  refresh();
}

/** One step earlier / later (the whole list is renumbered so the order is always clean). */
export async function moveStatCard(id: string, direction: "up" | "down") {
  const actor = await assertRole(isManager);
  const list = await db.statCard.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = list.findIndex((x) => x.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, order) => db.statCard.update({ where: { id: x.id }, data: { sortOrder: order + 1 } })));
  await audit({ actorId: actor.id, action: "stat.move", entity: "StatCard", entityId: id, meta: { direction } });
  refresh();
}

export async function deleteStatCard(id: string): Promise<{ error?: string }> {
  const actor = await assertRole(isManager);
  const r = await db.statCard.deleteMany({ where: { id } });
  if (!r.count) return { error: "ไม่พบการ์ดนี้" };
  await audit({ actorId: actor.id, action: "stat.delete", entity: "StatCard", entityId: id });
  refresh();
  return {};
}

/** Back to the four starter cards (the admin's own cards are removed). */
export async function resetStatCards(): Promise<{ error?: string }> {
  const actor = await assertRole(isManager);
  await db.$transaction([
    db.statCard.deleteMany({}),
    db.statCard.createMany({ data: DEFAULT_STAT_CARDS.map((c, i) => ({ id: c.id, metric: c.metric, visible: true, sortOrder: i + 1 })) }),
  ]);
  await audit({ actorId: actor.id, action: "stat.reset", entity: "StatCard" });
  refresh();
  return {};
}
