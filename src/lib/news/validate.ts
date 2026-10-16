/** Checks what the admin types into the news forms. Pure (no database, no network): the actions call it, the tests call it. */
import { z } from "zod";
import { parseInstant } from "@/lib/thai-date";
import { checkFeedUrl } from "./host-guard";
import { MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "./merge";
import { safeLink } from "./parse";

const int = (min: number, max: number, message: string) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v), z.number({ message }).int(message).min(min, message).max(max, message));

const optionalDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseInstant(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "วันที่ไม่ถูกต้อง" });
      return z.NEVER;
    }
    return d;
  });

const tabSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อหัวข้อ").max(60, "ชื่อหัวข้อไม่เกิน 60 ตัวอักษร"),
  pageSize: int(MIN_PAGE_SIZE, MAX_PAGE_SIZE, `จำนวนข่าวต่อหน้าต้องเป็นเลข ${MIN_PAGE_SIZE}–${MAX_PAGE_SIZE}`),
});

export type TabInput = { name: string; pageSize: number };
export function parseTabInput(raw: Record<string, unknown>): { ok: true; data: TabInput } | { ok: false; error: string } {
  const p = tabSchema.safeParse(raw);
  return p.success ? { ok: true, data: p.data } : { ok: false, error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
}

const linkSchema = z.object({
  tabId: z.string().min(1, "กรุณาเลือกแถบหัวข้อ"),
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อข่าว").max(200, "หัวข้อข่าวไม่เกิน 200 ตัวอักษร"),
  url: z.string().trim().min(1, "กรุณากรอกลิงก์"),
  note: z.string().trim().max(160, "หมายเหตุไม่เกิน 160 ตัวอักษร").optional().transform((v) => v || null),
  publishedAt: optionalDate,
});
const feedSchema = z.object({
  tabId: z.string().min(1, "กรุณาเลือกแถบหัวข้อ"),
  title: z.string().trim().min(1, "กรุณากรอกชื่อแหล่งข่าว").max(80, "ชื่อแหล่งข่าวไม่เกิน 80 ตัวอักษร"),
  url: z.string().trim().min(1, "กรุณากรอกลิงก์ฟีด"),
  feedLimit: int(5, 50, "จำนวนข่าวที่ดึงต้องเป็นเลข 5–50"),
  feedCacheMin: int(15, 360, "รอบดึงข้อมูลใหม่ต้องเป็นเลข 15–360 นาที"),
});

export type ItemInput = { tabId: string; kind: "LINK" | "FEED"; title: string; url: string; note: string | null; publishedAt: Date | null; pinned: boolean; active: boolean; feedLimit?: number; feedCacheMin?: number };

/** `raw` = the form fields. A typed link must be http(s); a feed address also has to pass the host guard. */
export function parseItemInput(kind: "LINK" | "FEED", raw: Record<string, unknown>, flags: { pinned: boolean; active: boolean }, opts: { allowPrivate?: boolean } = {}): { ok: true; data: ItemInput } | { ok: false; error: string } {
  if (kind === "LINK") {
    const p = linkSchema.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    const url = safeLink(p.data.url.includes("://") ? p.data.url : `https://${p.data.url}`);
    if (!url || url.length > 500) return { ok: false, error: "ลิงก์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย https:// หรือ http://)" };
    return { ok: true, data: { tabId: p.data.tabId, kind, title: p.data.title, url, note: p.data.note, publishedAt: p.data.publishedAt, pinned: flags.pinned, active: flags.active } };
  }
  const p = feedSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  const c = checkFeedUrl(p.data.url, opts);
  if (!c.ok) return { ok: false, error: c.error };
  return { ok: true, data: { tabId: p.data.tabId, kind, title: p.data.title, url: c.url, note: null, publishedAt: null, pinned: false, active: flags.active, feedLimit: p.data.feedLimit, feedCacheMin: p.data.feedCacheMin } };
}
