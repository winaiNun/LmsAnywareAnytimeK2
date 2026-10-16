/** Checks what the admin types into the stat-card form. Pure: the action calls it, the tests call it. */
import { MAX_STAT_LABEL, isStatIcon, isStatMetric, type StatMetric } from "./metrics";

export type CardInput = { metric: StatMetric; label: string | null; icon: string | null };

export function parseCardInput(raw: Record<string, unknown>): { ok: true; data: CardInput } | { ok: false; error: string } {
  const metric = typeof raw.metric === "string" ? raw.metric : "";
  if (!isStatMetric(metric)) return { ok: false, error: "กรุณาเลือกตัวเลขที่จะแสดง" };
  const label = typeof raw.label === "string" ? raw.label.replace(/\s+/g, " ").trim() : "";
  if (label.length > MAX_STAT_LABEL) return { ok: false, error: `ป้ายชื่อไม่เกิน ${MAX_STAT_LABEL} ตัวอักษร` };
  const icon = typeof raw.icon === "string" ? raw.icon.trim() : "";
  if (icon && !isStatIcon(icon)) return { ok: false, error: "ไอคอนไม่ถูกต้อง" };
  return { ok: true, data: { metric, label: label || null, icon: icon || null } };
}
