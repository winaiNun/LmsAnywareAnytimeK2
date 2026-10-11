/* Run with: npm run test:media (also part of npm test) - the media permission table */
import assert from "node:assert/strict";
import { canAddItemKind, canDecide, canEditMedia, canManageMedia, canPreviewMedia, canReviewMedia, showsOwnerIdentity, statusAfterSave, type Actor } from "../src/lib/media-access";

let passed = 0;
const t = (name: string, fn: () => void) => { try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${(e as Error).message}`); process.exitCode = 1; } };

const admin: Actor = { id: "admin", role: "ADMIN", memberType: "GENERAL", reviewerAreaIds: [] };
const revMath: Actor = { id: "revM", role: "STUDENT", memberType: "TEACHER", reviewerAreaIds: ["math"] };
const revSci: Actor = { id: "revS", role: "STUDENT", memberType: "TEACHER", reviewerAreaIds: ["science"] };
const author: Actor = { id: "author", role: "STUDENT", memberType: "TEACHER", reviewerAreaIds: [] };
const other: Actor = { id: "other", role: "STUDENT", memberType: "GENERAL", reviewerAreaIds: [] };
const student: Actor = { id: "kid", role: "STUDENT", memberType: "STUDENT", reviewerAreaIds: [] };
const item = (status: "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED", createdById = "author", areaId = "math") => ({ createdById, areaId, status });

t("edit / delete: author and admin only", () => {
  assert.equal(canEditMedia(author, item("DRAFT")), true);
  assert.equal(canEditMedia(admin, item("PUBLISHED")), true);
  for (const a of [other, revMath, revSci, student]) assert.equal(canEditMedia(a, item("DRAFT")), false, a.id);
});

t("review: admin, or the reviewer of THAT area, never your own", () => {
  assert.equal(canReviewMedia(admin, item("PENDING")), true);
  assert.equal(canReviewMedia(revMath, item("PENDING")), true);
  assert.equal(canReviewMedia(revSci, item("PENDING")), false, "reviewer of another area");
  assert.equal(canReviewMedia(author, item("PENDING")), false);
  assert.equal(canReviewMedia(other, item("PENDING")), false);
  assert.equal(canReviewMedia(revMath, item("PENDING", "revM")), false, "no self-approval");
  assert.equal(canReviewMedia(admin, item("PENDING", "admin")), true, "admins post straight to published anyway");
});

t("decisions only apply to the pending queue", () => {
  assert.equal(canDecide("PENDING"), true);
  for (const s of ["DRAFT", "PUBLISHED", "REJECTED"] as const) assert.equal(canDecide(s), false, s);
});

t("preview of unpublished items", () => {
  assert.equal(canPreviewMedia(null, item("PUBLISHED")), true, "anyone sees published");
  assert.equal(canPreviewMedia(null, item("PENDING")), false);
  assert.equal(canPreviewMedia(other, item("DRAFT")), false);
  assert.equal(canPreviewMedia(author, item("DRAFT")), true);
  assert.equal(canPreviewMedia(revMath, item("PENDING")), true);
  assert.equal(canPreviewMedia(revSci, item("PENDING")), false);
  assert.equal(canPreviewMedia(admin, item("REJECTED")), true);
});

t("pin / unpublish: admin only", () => {
  assert.equal(canManageMedia(admin), true);
  for (const a of [revMath, author, other, student]) assert.equal(canManageMedia(a), false);
});

t("status after save", () => {
  // admins
  assert.equal(statusAfterSave(admin, null, true), "PUBLISHED");
  assert.equal(statusAfterSave(admin, null, false), "DRAFT");
  assert.equal(statusAfterSave(admin, "PUBLISHED", false), "PUBLISHED");
  assert.equal(statusAfterSave(admin, "REJECTED", true), "PUBLISHED");
  // everybody else goes through the queue
  assert.equal(statusAfterSave(author, null, true), "PENDING");
  assert.equal(statusAfterSave(author, null, false), "DRAFT");
  assert.equal(statusAfterSave(author, "REJECTED", false), "DRAFT");
  assert.equal(statusAfterSave(author, "REJECTED", true), "PENDING", "fix and resubmit");
  assert.equal(statusAfterSave(author, "PUBLISHED", false), "PENDING", "editing live content needs a new approval");
  assert.equal(statusAfterSave(author, "PUBLISHED", true), "PENDING");
  assert.equal(statusAfterSave(revMath, null, true), "PENDING", "reviewers do not self-publish");
});

t("what students may add", () => {
  assert.deepEqual(canAddItemKind(student, "LINK", true), { ok: true });
  assert.equal(canAddItemKind(student, "HTML", true).ok, false);
  assert.equal(canAddItemKind(student, "UPLOAD", true).ok, false);
  assert.deepEqual(canAddItemKind(author, "HTML", false), { ok: true });
  assert.equal(canAddItemKind(author, "UPLOAD", false).ok, false, "uploads are off until the admin switches them on");
  assert.deepEqual(canAddItemKind(author, "UPLOAD", true), { ok: true });
  assert.deepEqual(canAddItemKind(admin, "UPLOAD", true), { ok: true });
});

t("student identity is hidden on public pages", () => {
  assert.equal(showsOwnerIdentity("STUDENT"), false);
  for (const m of ["TEACHER", "SUPERVISOR", "GENERAL", null, undefined]) assert.equal(showsOwnerIdentity(m), true, String(m));
});

console.log(`media access: ${passed} passed`);
