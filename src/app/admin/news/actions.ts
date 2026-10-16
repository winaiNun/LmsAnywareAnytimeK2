"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { fetchFeed } from "@/lib/news/fetch";
import { allowPrivateForTests } from "@/lib/news/host-guard";
import { MAX_ITEMS, MAX_TABS } from "@/lib/news/merge";
import { parseItemInput, parseTabInput } from "@/lib/news/validate";
import { assertRole, isManager } from "@/lib/permissions";
import { rateLimited } from "@/lib/rate-limit";

export type NewsFormState = { error?: string; saved?: boolean } | undefined;

function refresh() {
  revalidateTag("news");
  revalidatePath("/admin/news");
  revalidatePath("/news");
  revalidatePath("/");
}

export async function saveTab(id: string | null, _prev: NewsFormState, f: FormData): Promise<NewsFormState> {
  const actor = await assertRole(isManager);
  const p = parseTabInput(Object.fromEntries(f));
  if (!p.ok) return { error: p.error };
  const data = { name: p.data.name, pageSize: p.data.pageSize, active: f.get("active") === "on" };
  if (id) {
    const r = await db.newsTab.updateMany({ where: { id }, data });
    if (!r.count) return { error: "ไม่พบหัวข้อนี้" };
    await audit({ actorId: actor.id, action: "news.tab.update", entity: "NewsTab", entityId: id });
  } else {
    if ((await db.newsTab.count()) >= MAX_TABS) return { error: `สร้างหัวข้อได้ไม่เกิน ${MAX_TABS} หัวข้อ` };
    const last = await db.newsTab.aggregate({ _max: { sortOrder: true } });
    const row = await db.newsTab.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    await audit({ actorId: actor.id, action: "news.tab.create", entity: "NewsTab", entityId: row.id });
  }
  refresh();
  return { saved: true };
}

export async function setTabActive(id: string, active: boolean) {
  const actor = await assertRole(isManager);
  await db.newsTab.updateMany({ where: { id }, data: { active } });
  await audit({ actorId: actor.id, action: active ? "news.tab.show" : "news.tab.hide", entity: "NewsTab", entityId: id });
  refresh();
}

/** One step earlier / later (the whole list is renumbered so the order is always clean). */
export async function moveTab(id: string, direction: "up" | "down") {
  await assertRole(isManager);
  const list = await db.newsTab.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = list.findIndex((x) => x.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, order) => db.newsTab.update({ where: { id: x.id }, data: { sortOrder: order } })));
  refresh();
}

/** Deleting a tab deletes its items too (the form asks first). */
export async function deleteTab(id: string): Promise<{ error?: string }> {
  const actor = await assertRole(isManager);
  const count = await db.newsItem.count({ where: { tabId: id } });
  const r = await db.newsTab.deleteMany({ where: { id } });
  if (!r.count) return { error: "ไม่พบหัวข้อนี้" };
  await audit({ actorId: actor.id, action: "news.tab.delete", entity: "NewsTab", entityId: id, meta: { items: count } });
  refresh();
  return {};
}

// ------------------------------------------------------------------------------------------------ items
/** Create (id null) or update one item. The kind is chosen when it is created and can not change. */
export async function saveItem(id: string | null, _prev: NewsFormState, f: FormData): Promise<NewsFormState> {
  const actor = await assertRole(isManager);
  const raw = Object.fromEntries(f);
  const existing = id ? await db.newsItem.findUnique({ where: { id }, select: { id: true, kind: true } }) : null;
  if (id && !existing) return { error: "ไม่พบรายการนี้" };
  const kind = existing ? existing.kind : raw.kind === "FEED" ? "FEED" : "LINK";
  const active = f.get("active") === "on";

  const parsed = parseItemInput(kind, raw, { pinned: f.get("pinned") === "on", active }, { allowPrivate: allowPrivateForTests() });
  if (!parsed.ok) return { error: parsed.error };
  const data = parsed.data;
  if (!(await db.newsTab.findUnique({ where: { id: data.tabId }, select: { id: true } }))) return { error: "ไม่พบแถบหัวข้อที่เลือก" };

  if (id) {
    await db.newsItem.update({ where: { id }, data });
    await audit({ actorId: actor.id, action: "news.item.update", entity: "NewsItem", entityId: id });
    if (kind === "FEED") revalidateTag(`news-feed-${id}`); // address or limits may have changed
  } else {
    if ((await db.newsItem.count()) >= MAX_ITEMS) return { error: `เพิ่มรายการได้ไม่เกิน ${MAX_ITEMS} รายการ กรุณาลบรายการเก่าก่อน` };
    const row = await db.newsItem.create({ data });
    await audit({ actorId: actor.id, action: "news.item.create", entity: "NewsItem", entityId: row.id, meta: { kind, url: data.url } });
  }
  refresh();
  return { saved: true };
}

export async function setItemActive(id: string, active: boolean) {
  const actor = await assertRole(isManager);
  await db.newsItem.updateMany({ where: { id }, data: { active } });
  await audit({ actorId: actor.id, action: active ? "news.item.show" : "news.item.hide", entity: "NewsItem", entityId: id });
  refresh();
}

export async function setItemPinned(id: string, pinned: boolean) {
  const actor = await assertRole(isManager);
  await db.newsItem.updateMany({ where: { id, kind: "LINK" }, data: { pinned } });
  await audit({ actorId: actor.id, action: pinned ? "news.item.pin" : "news.item.unpin", entity: "NewsItem", entityId: id });
  refresh();
}

export async function deleteItem(id: string): Promise<{ error?: string }> {
  const actor = await assertRole(isManager);
  const r = await db.newsItem.deleteMany({ where: { id } });
  if (!r.count) return { error: "ไม่พบรายการนี้" };
  await audit({ actorId: actor.id, action: "news.item.delete", entity: "NewsItem", entityId: id });
  refresh();
  return {};
}

/** Throw the cached copy of one feed away so the next visit downloads it again. */
export async function refreshFeed(id: string) {
  await assertRole(isManager);
  revalidateTag(`news-feed-${id}`);
  revalidatePath("/");
  revalidatePath("/news");
}

// ------------------------------------------------------------------------------------------------ "test this feed"
export type FeedTest = { ok: true; title: string; count: number; sample: { title: string; date: string | null; hasImage: boolean }[] } | { ok: false; error: string };

/** Downloads the feed once for the admin form (not cached, not stored) so a wrong address shows up before saving. */
export async function testFeed(url: string): Promise<FeedTest> {
  const actor = await assertRole(isManager);
  if (rateLimited(`news-test:${actor.id}`, 20, 10 * 60 * 1000)) return { ok: false, error: "ทดสอบบ่อยเกินไป กรุณารอสักครู่" };
  const r = await fetchFeed(url);
  if (!r.ok) return { ok: false, error: r.error };
  if (!r.feed.entries.length) return { ok: false, error: "เป็นฟีดที่ถูกต้อง แต่ยังไม่มีข่าวที่อ่านได้ในฟีดนี้" };
  return { ok: true, title: r.feed.title, count: r.feed.entries.length, sample: r.feed.entries.slice(0, 3).map((e) => ({ title: e.title, date: e.date, hasImage: !!e.image })) };
}
