"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { safeHttpsUrl } from "@/lib/embed";
import { assertRole, isAdmin } from "@/lib/permissions";
import { PAGE_META, isPageSlug } from "@/lib/site-pages";
import { TEXT_DEFS } from "@/lib/site-texts";
import { parseInstant } from "@/lib/thai-date";

export type PagesFormState = { error?: string; saved?: boolean } | undefined;

const optionalUrl = z.string().trim().max(300).optional().transform((v, ctx) => {
  if (!v) return null;
  const r = safeHttpsUrl(v);
  if ("error" in r) {
    ctx.addIssue({ code: "custom", message: r.error });
    return z.NEVER;
  }
  return r.url;
});
const optionalText = (max: number) => z.string().trim().max(max, `ยาวเกินไป (ไม่เกิน ${max} ตัวอักษร)`).optional().transform((v) => v || null);

const footerSchema = z.object({
  contactAddress: optionalText(300),
  contactPhone: optionalText(40),
  contactEmail: z.string().trim().max(120).optional().transform((v) => v || null).refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "อีเมลติดต่อไม่ถูกต้อง"),
  facebookUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  lineUrl: optionalUrl,
  counterBase: z.string().optional().transform((v) => (v && v.trim() ? Number(v.replace(/,/g, "")) : 0)).refine((v) => Number.isInteger(v) && v >= 0 && v <= 1_000_000_000, "ตัวเลขตั้งต้นต้องเป็นจำนวนเต็ม 0 ขึ้นไป"),
  counterSince: z.string().optional().transform((v) => (v ? parseInstant(v) : null)),
});

/** Contact details + social links (footer and contact page) and the visitor-counter settings. */
export async function saveFooterSettings(_prev: PagesFormState, f: FormData): Promise<PagesFormState> {
  const actor = await assertRole(isAdmin);
  const p = footerSchema.safeParse(Object.fromEntries(f));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const { counterSince, ...rest } = p.data;
  const data = { ...rest, ...(counterSince ? { counterSince } : {}), showVisits: f.get("showVisits") === "on" };
  await db.siteSetting.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });
  await audit({ actorId: actor.id, action: "site.footer-settings", entity: "SiteSetting", entityId: "main" });
  revalidateTag("footer");
  revalidatePath("/admin/pages");
  revalidatePath("/contact");
  return { saved: true };
}

const pageSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อ").max(100, "หัวข้อไม่เกิน 100 ตัวอักษร"),
  body: z.string().trim().min(1, "กรุณากรอกเนื้อหา").max(20000, "เนื้อหายาวเกินไป (ไม่เกิน 20,000 ตัวอักษร)"),
});

export async function savePage(slug: string, _prev: PagesFormState, f: FormData): Promise<PagesFormState> {
  const actor = await assertRole(isAdmin);
  if (!isPageSlug(slug)) return { error: "ไม่พบหน้า" };
  const p = pageSchema.safeParse(Object.fromEntries(f));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  await db.sitePage.upsert({ where: { slug }, update: p.data, create: { slug, ...p.data } });
  await audit({ actorId: actor.id, action: "site.page-save", entity: "SitePage", entityId: slug });
  revalidatePath(PAGE_META[slug].path);
  revalidatePath("/admin/pages");
  return { saved: true };
}

/** Back to the built-in text of the page. */
export async function resetPage(slug: string): Promise<{ error?: string }> {
  const actor = await assertRole(isAdmin);
  if (!isPageSlug(slug)) return { error: "ไม่พบหน้า" };
  await db.sitePage.deleteMany({ where: { slug } });
  await audit({ actorId: actor.id, action: "site.page-reset", entity: "SitePage", entityId: slug });
  revalidatePath(PAGE_META[slug].path);
  revalidatePath("/admin/pages");
  return {};
}

/** Menu names and page headings (text only). A blank box, or the same text as the default, means "use the default". */
export async function saveTexts(_prev: PagesFormState, f: FormData): Promise<PagesFormState> {
  const actor = await assertRole(isAdmin);
  const texts: Record<string, string> = {};
  for (const d of TEXT_DEFS) {
    const v = String(f.get(d.key) ?? "").replace(/\s+/g, " ").trim();
    if (v.length > d.max) return { error: `“${d.label}” ยาวเกินไป (ไม่เกิน ${d.max} ตัวอักษร)` };
    if (v && v !== d.def) texts[d.key] = v;
  }
  await db.siteSetting.upsert({ where: { id: "main" }, update: { texts }, create: { id: "main", texts } });
  await audit({ actorId: actor.id, action: "site.texts", entity: "SiteSetting", entityId: "main", meta: { changed: Object.keys(texts) } });
  revalidateTag("texts");
  revalidatePath("/", "layout");
  return { saved: true };
}
