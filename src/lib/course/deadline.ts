/**
 * "Must take" and "finish by": two independent options of a course (Course.mandatory, Course.dueAt). Pure functions, shared by the
 * server and the pages. Nothing here is on unless an author switches it on, so courses without them behave exactly as before.
 * A due date is a deadline, not a lock: finishing later is allowed and only marked late.
 */
import { diffCalendarDays, formatThaiDate } from "@/lib/thai-date";

export const SOON_DAYS = 7;

export type DueState = "none" | "open" | "soon" | "today" | "overdue" | "done" | "done-late";

/** Where one learner stands against the due date. `completedAt` set = finished. */
export function dueState(dueAt: Date | null, now: Date, completedAt: Date | null): DueState {
  if (!dueAt) return completedAt ? "done" : "none";
  if (completedAt) return completedAt.getTime() > dueAt.getTime() ? "done-late" : "done";
  if (now.getTime() > dueAt.getTime()) return "overdue";
  const days = diffCalendarDays(now, dueAt);
  if (days === 0) return "today";
  return days <= SOON_DAYS ? "soon" : "open";
}

/** The course is a "must take" for this member type (never for students, whatever the course says). */
export const isMandatoryFor = (c: { mandatory: boolean; audienceTypes: readonly string[] }, memberType?: string | null): boolean =>
  c.mandatory && !!memberType && memberType !== "STUDENT" && c.audienceTypes.includes(memberType);

/** Problems with the "must take" setting itself (Thai message, null = fine). */
export function checkMandatory(c: { mandatory: boolean; audienceTypes: readonly string[] }): string | null {
  if (!c.mandatory) return null;
  if (c.audienceTypes.length === 0) return "คอร์สบังคับต้องเลือกกลุ่มเป้าหมายก่อน (บังคับให้ใครเรียน)";
  if (c.audienceTypes.includes("STUDENT")) return "ไม่บังคับนักเรียนเรียนคอร์ส — เอา “นักเรียน” ออกจากกลุ่มเป้าหมาย หรือปิดการบังคับ";
  return null;
}

const TONE: Record<DueState, string> = {
  none: "",
  open: "bg-neutral-100 text-neutral-700",
  soon: "bg-amber-50 text-amber-800",
  today: "bg-amber-100 text-amber-900",
  overdue: "bg-red-50 text-red-700",
  done: "bg-green-50 text-green-700",
  "done-late": "bg-green-50 text-green-700",
};

/** Short Thai text and colour for a due state, e.g. "เหลือ 3 วัน (31 ต.ค. 2569)". */
export function dueText(state: DueState, dueAt: Date | null, now: Date): { text: string; tone: string } {
  if (state === "none" || !dueAt) return { text: state === "done" ? "เรียนจบแล้ว" : "", tone: TONE[state] };
  const date = formatThaiDate(dueAt, { style: "medium" });
  const days = diffCalendarDays(now, dueAt);
  switch (state) {
    case "open":
    case "soon":
      return { text: `เหลือ ${days} วัน · ภายใน ${date}`, tone: TONE[state] };
    case "today":
      return { text: `ครบกำหนดวันนี้ (${date})`, tone: TONE[state] };
    case "overdue":
      return { text: `เกินกำหนด ${Math.max(1, -days)} วัน (${date})`, tone: TONE[state] };
    case "done":
      return { text: "เรียนจบทันกำหนด", tone: TONE[state] };
    case "done-late":
      return { text: "เรียนจบหลังกำหนด", tone: TONE[state] };
  }
}
