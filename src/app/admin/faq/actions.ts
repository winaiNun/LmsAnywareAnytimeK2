"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { MAX_FAQ_ITEMS } from "@/lib/faq/store";
import { STARTER_FAQS } from "@/lib/faq/starters";
import { assertRole, isManager } from "@/lib/permissions";

export type FaqFormState = { error?: string; saved?: boolean } | undefined;

const schema = z.object({
  question: z.string().trim().min(2, "กรุณากรอกคำถาม").max(200, "คำถามไม่เกิน 200 ตัวอักษร"),
  answer: z.string().trim().min(2, "กรุณากรอกคำตอบ").max(1000, "คำตอบไม่เกิน 1,000 ตัวอักษร"),
  keywords: z.string().trim().max(300, "คำที่เกี่ยวข้องไม่เกิน 300 ตัวอักษร").optional().transform((v) => v ?? ""),
});

function refresh() {
  revalidatePath("/admin/faq");
  revalidateTag("faq");
}

/**
 * Create (id null) or update one Q&A. When the form was opened from an "unanswered" row, that row is marked ANSWERED
 * in the same transaction. The new item goes to the end of the list.
 */
export async function saveFaq(id: string | null, _prev: FaqFormState, f: FormData): Promise<FaqFormState> {
  const actor = await assertRole(isManager);
  const parsed = schema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const data = { ...parsed.data, pinned: f.get("pinned") === "on", active: f.get("active") === "on" };
  const fromId = String(f.get("fromUnanswered") ?? "");

  if (id) {
    const r = await db.faqItem.updateMany({ where: { id }, data });
    if (!r.count) return { error: "ไม่พบรายการ" };
    await audit({ actorId: actor.id, action: "faq.update", entity: "FaqItem", entityId: id });
  } else {
    if ((await db.faqItem.count()) >= MAX_FAQ_ITEMS) return { error: `เพิ่มได้ไม่เกิน ${MAX_FAQ_ITEMS} ข้อ กรุณาลบข้อที่ไม่ใช้ก่อน` };
    const last = await db.faqItem.aggregate({ _max: { sortOrder: true } });
    const row = await db.$transaction(async (tx) => {
      const created = await tx.faqItem.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
      if (fromId) await tx.faqUnanswered.updateMany({ where: { id: fromId }, data: { status: "ANSWERED" } });
      return created;
    });
    await audit({ actorId: actor.id, action: "faq.create", entity: "FaqItem", entityId: row.id, meta: fromId ? { fromUnanswered: fromId } : undefined });
  }
  refresh();
  return { saved: true };
}

export async function setFaqActive(id: string, active: boolean) {
  const actor = await assertRole(isManager);
  await db.faqItem.updateMany({ where: { id }, data: { active } });
  await audit({ actorId: actor.id, action: active ? "faq.show" : "faq.hide", entity: "FaqItem", entityId: id });
  refresh();
}

export async function setFaqPinned(id: string, pinned: boolean) {
  const actor = await assertRole(isManager);
  await db.faqItem.updateMany({ where: { id }, data: { pinned } });
  await audit({ actorId: actor.id, action: pinned ? "faq.pin" : "faq.unpin", entity: "FaqItem", entityId: id });
  refresh();
}

/** One step earlier / later (the whole list is renumbered so the order is always clean). */
export async function moveFaq(id: string, direction: "up" | "down") {
  await assertRole(isManager);
  const list = await db.faqItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = list.findIndex((x) => x.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((x, order) => db.faqItem.update({ where: { id: x.id }, data: { sortOrder: order } })));
  refresh();
}

export async function deleteFaq(id: string): Promise<{ error?: string }> {
  const actor = await assertRole(isManager);
  const r = await db.faqItem.deleteMany({ where: { id } });
  if (!r.count) return { error: "ไม่พบรายการ" };
  await audit({ actorId: actor.id, action: "faq.delete", entity: "FaqItem", entityId: id });
  refresh();
  return {};
}

/** Adds the built-in starter questions as hidden drafts (skips any question already in the list). */
export async function addStarterFaqs(): Promise<{ error?: string; added?: number }> {
  const actor = await assertRole(isManager);
  const existing = await db.faqItem.findMany({ select: { question: true } });
  const have = new Set(existing.map((e) => e.question));
  const fresh = STARTER_FAQS.filter((s) => !have.has(s.question));
  if (!fresh.length) return { added: 0 };
  if (existing.length + fresh.length > MAX_FAQ_ITEMS) return { error: "จำนวนคำถามจะเกินที่กำหนด" };
  const last = await db.faqItem.aggregate({ _max: { sortOrder: true } });
  let order = (last._max.sortOrder ?? 0) + 1;
  await db.faqItem.createMany({ data: fresh.map((s) => ({ ...s, active: false, sortOrder: order++ })) });
  await audit({ actorId: actor.id, action: "faq.seed", entity: "FaqItem", meta: { added: fresh.length } });
  refresh();
  return { added: fresh.length };
}

/** The chat on/off switch for the whole site. */
export async function setFaqEnabled(enabled: boolean) {
  const actor = await assertRole(isManager);
  await db.siteSetting.upsert({ where: { id: "main" }, update: { faqEnabled: enabled }, create: { id: "main", faqEnabled: enabled } });
  await audit({ actorId: actor.id, action: enabled ? "faq.enable" : "faq.disable", entity: "SiteSetting", entityId: "main" });
  refresh();
  revalidatePath("/", "layout");
}

export async function setUnansweredStatus(id: string, status: "OPEN" | "DISMISSED") {
  const actor = await assertRole(isManager);
  await db.faqUnanswered.updateMany({ where: { id }, data: { status } });
  await audit({ actorId: actor.id, action: status === "DISMISSED" ? "faq.unanswered.dismiss" : "faq.unanswered.reopen", entity: "FaqUnanswered", entityId: id });
  revalidatePath("/admin/faq");
}

export async function deleteUnanswered(id: string) {
  const actor = await assertRole(isManager);
  await db.faqUnanswered.deleteMany({ where: { id } });
  await audit({ actorId: actor.id, action: "faq.unanswered.delete", entity: "FaqUnanswered", entityId: id });
  revalidatePath("/admin/faq");
}

/** Clears every row that is already handled (answered or dismissed). */
export async function clearHandledUnanswered(): Promise<{ deleted: number }> {
  const actor = await assertRole(isManager);
  const r = await db.faqUnanswered.deleteMany({ where: { status: { in: ["ANSWERED", "DISMISSED"] } } });
  await audit({ actorId: actor.id, action: "faq.unanswered.clear", entity: "FaqUnanswered", meta: { deleted: r.count } });
  revalidatePath("/admin/faq");
  return { deleted: r.count };
}
