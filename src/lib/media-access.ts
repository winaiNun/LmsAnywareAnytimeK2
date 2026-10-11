/**
 * Who may do what with a media item. Pure functions (the server actions load the facts, these decide), so the
 * whole permission table can be unit-tested. Reviewers are ordinary members appointed per learning area.
 */
export type MediaStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED";

export type Actor = {
  id: string;
  role: string; // ADMIN | LIBRARIAN | TEACHER | STUDENT (permission role)
  memberType?: string; // STUDENT | TEACHER | SUPERVISOR | GENERAL
  reviewerAreaIds: string[];
};
type MediaFacts = { createdById: string; areaId: string; status?: MediaStatus };

export const DAILY_SUBMIT_LIMIT = 20;
export const MAX_ITEMS = 10;
export const MAX_HTML_BYTES = 500 * 1024;

export const isMediaAdmin = (a: Pick<Actor, "role">) => a.role === "ADMIN";
export const isReviewer = (a: Actor) => a.reviewerAreaIds.length > 0;

/** Edit / delete: the author, or an admin. */
export const canEditMedia = (a: Actor, m: MediaFacts) => isMediaAdmin(a) || a.id === m.createdById;

/** Approve / send back: an admin, or the reviewer of this area (never for their own submission). */
export const canReviewMedia = (a: Actor, m: MediaFacts) => isMediaAdmin(a) || (a.reviewerAreaIds.includes(m.areaId) && a.id !== m.createdById);

/** Preview something that is not published yet. A reviewer may look at their own area's items even when they wrote them. */
export const canPreviewMedia = (a: Actor | null, m: MediaFacts) =>
  m.status === "PUBLISHED" || (!!a && (canEditMedia(a, m) || isMediaAdmin(a) || a.reviewerAreaIds.includes(m.areaId)));

/** Pin to the top / unpublish: admins only. */
export const canManageMedia = (a: Actor) => isMediaAdmin(a);

/** What a save does to the status. `submit` = the "send for approval" (or, for admins, "publish") button. */
export function statusAfterSave(a: Actor, current: MediaStatus | null, submit: boolean): MediaStatus {
  if (isMediaAdmin(a)) return submit || current === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  if (submit) return "PENDING";
  // changing something that is live puts it back in the queue; the rest stays a draft
  return current === "PUBLISHED" || current === "PENDING" ? "PENDING" : "DRAFT";
}

/** Students may add links only (no pasted HTML, no uploads): less risk, less to review. */
export type ItemKindInput = "LINK" | "HTML" | "UPLOAD";
export function canAddItemKind(a: Pick<Actor, "memberType" | "role">, kind: ItemKindInput, uploadsAllowed: boolean): { ok: true } | { ok: false; error: string } {
  const student = a.memberType === "STUDENT" && a.role !== "ADMIN";
  if (kind === "LINK") return { ok: true };
  if (student) return { ok: false, error: "นักเรียนเพิ่มได้เฉพาะลิงก์" };
  if (kind === "UPLOAD" && !uploadsAllowed) return { ok: false, error: "ขณะนี้ปิดการอัปโหลดไฟล์เข้าเซิร์ฟเวอร์ — ใช้ลิงก์ Google Drive แทน" };
  return { ok: true };
}

/** Review decisions only apply to things waiting in the queue. */
export const canDecide = (status: MediaStatus) => status === "PENDING";

/** Public pages show the owner's face/name unless the owner is a student (a minor). */
export const showsOwnerIdentity = (memberType: string | null | undefined) => memberType !== "STUDENT";
