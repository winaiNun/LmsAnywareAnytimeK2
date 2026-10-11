"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { CHOICE_KEYS } from "@/lib/icon-paths";
import { assertRole, isAdmin } from "@/lib/permissions";

export type TaxState = { error?: string; saved?: boolean } | undefined;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const base = {
  name: z.string().trim().min(2, "กรุณากรอกชื่อ").max(80),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
};
const areaSchema = z.object({ ...base, icon: z.enum(CHOICE_KEYS, { error: "เลือกไอคอนจากรายการ" }), color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "สีไม่ถูกต้อง"), slug: z.string().trim().toLowerCase().optional() });
const typeSchema = z.object({ ...base, icon: z.enum(CHOICE_KEYS, { error: "เลือกไอคอนจากรายการ" }), slug: z.string().trim().toLowerCase().optional() });
const levelSchema = z.object({ ...base, slug: z.string().trim().toLowerCase().optional() });

function refresh() {
  for (const p of ["/admin/media-taxonomy", "/library", "/", "/admin/media"]) revalidatePath(p);
}

type Kind = "area" | "type" | "level";

/** Create (id = null) or edit one learning area / media type / education level. */
export async function saveTaxonomy(kind: Kind, id: string | null, _prev: TaxState, formData: FormData): Promise<TaxState> {
  const actor = await assertRole(isAdmin);
  const raw = Object.fromEntries(formData);
  // Learning areas: a "|" in the name is the admin's own line break on the home cards ("A|B" -> name "A B", card shows two lines).
  let cardName: string | null = null;
  if (kind === "area" && typeof raw.name === "string" && raw.name.includes("|")) {
    const parts = raw.name.split("|").map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (parts.length > 4) return { error: "ขึ้นบรรทัดใหม่ได้ไม่เกิน 4 บรรทัด" };
    cardName = parts.length > 1 ? parts.join("\n") : null;
    raw.name = parts.join(" ");
  }
  const schema = kind === "area" ? areaSchema : kind === "type" ? typeSchema : levelSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data as Record<string, string | number | undefined>;
  const active = formData.get("active") === "on" || !id; // new items start active
  const slug = String(d.slug ?? "");
  if (!id && !SLUG.test(slug)) return { error: "รหัสภาษาอังกฤษ (slug) ใช้ a-z 0-9 และขีดกลางเท่านั้น เช่น math-fun" };

  const table = kind === "area" ? db.learningArea : kind === "type" ? db.mediaType : db.educationLevel;
  const common = { name: String(d.name), sortOrder: Number(d.sortOrder), active };
  const extra = kind === "area" ? { icon: String(d.icon), color: String(d.color), cardName } : kind === "type" ? { icon: String(d.icon) } : {};
  try {
    // @ts-expect-error the three tables share these columns; Prisma's delegates are not assignable to one union type
    if (id) await table.update({ where: { id }, data: { ...common, ...extra } });
    // @ts-expect-error same as above
    else await table.create({ data: { id: `${kind}_${slug}`, slug, ...common, ...extra } });
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") return { error: "รหัสภาษาอังกฤษ (slug) นี้ถูกใช้แล้ว" };
    throw e;
  }
  await audit({ actorId: actor.id, action: `taxonomy.${id ? "update" : "create"}`, entity: kind, entityId: id ?? `${kind}_${slug}`, meta: { name: String(d.name) } });
  refresh();
  return { saved: true };
}

/** Deleting is only for rows nothing uses; otherwise switch them off ("hide") so old media keep their label. */
export async function deleteTaxonomy(kind: Kind, id: string): Promise<{ error?: string }> {
  const actor = await assertRole(isAdmin);
  if (kind === "area") {
    if (await db.media.count({ where: { areaId: id } })) return { error: "มีสื่ออยู่ในกลุ่มสาระนี้ ลบไม่ได้ — ให้ปิดการใช้งานแทน" };
    await db.learningArea.delete({ where: { id } });
  } else if (kind === "type") {
    if (await db.media.count({ where: { typeId: id } })) return { error: "มีสื่อใช้ประเภทนี้อยู่ ลบไม่ได้ — ให้ปิดการใช้งานแทน" };
    await db.mediaType.delete({ where: { id } });
  } else {
    if (await db.mediaLevel.count({ where: { levelId: id } })) return { error: "มีสื่อใช้ระดับชั้นนี้อยู่ ลบไม่ได้ — ให้ปิดการใช้งานแทน" };
    await db.educationLevel.delete({ where: { id } });
  }
  await audit({ actorId: actor.id, action: "taxonomy.delete", entity: kind, entityId: id });
  refresh();
  return {};
}

/** Appoint a member as reviewer of a learning area: by exact e-mail or username. */
export async function addReviewer(areaId: string, _prev: TaxState, formData: FormData): Promise<TaxState> {
  const actor = await assertRole(isAdmin);
  const who = String(formData.get("who") ?? "").trim().toLowerCase();
  if (who.length < 3) return { error: "กรอกอีเมลหรือชื่อผู้ใช้ของสมาชิก" };
  const user = await db.user.findFirst({ where: { active: true, OR: [{ email: who }, { username: who }] }, select: { id: true, name: true } });
  if (!user) return { error: "ไม่พบสมาชิกที่ใช้อีเมล/ชื่อผู้ใช้นี้" };
  if (!(await db.learningArea.findUnique({ where: { id: areaId }, select: { id: true } }))) return { error: "ไม่พบกลุ่มสาระ" };
  await db.areaReviewer.upsert({ where: { userId_areaId: { userId: user.id, areaId } }, create: { userId: user.id, areaId }, update: {} });
  await audit({ actorId: actor.id, action: "reviewer.add", entity: "LearningArea", entityId: areaId, meta: { user: user.name } });
  refresh();
  return { saved: true };
}

export async function removeReviewer(areaId: string, userId: string): Promise<void> {
  const actor = await assertRole(isAdmin);
  await db.areaReviewer.deleteMany({ where: { areaId, userId } });
  await audit({ actorId: actor.id, action: "reviewer.remove", entity: "LearningArea", entityId: areaId, meta: { userId } });
  refresh();
}
