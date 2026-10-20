import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { AUDIT_LABELS, auditLabel, auditLink, auditMeta } from "../src/lib/audit-labels";
import { BACKUP_DANGER_DAYS, BACKUP_WARN_DAYS, backupState } from "../src/lib/backup-status";
import { cleanPath, fingerprintOf, scrub } from "../src/lib/error-log";

// 1) the error log keeps nothing personal
assert.equal(scrub("failed for somchai@example.com", 300), "failed for [email]");
assert.equal(scrub("id 1234567890123 and phone 0812345678", 300), "id [number] and phone [number]", "ID card numbers and phone numbers are masked");
assert.equal(scrub("GET /x?token=abc123&y=1", 300), "GET /x?token=[x]&y=1", "tokens in URLs are masked");
assert.equal(scrub("a".repeat(1000), 300).length, 300, "bounded");
assert.equal(cleanPath("/courses/abc?token=secret#top"), "/courses/abc", "query string and fragment never reach the log");
assert.equal(cleanPath(""), "/");
assert.equal(cleanPath("no-slash"), "/no-slash");
assert.equal(cleanPath("/" + "x".repeat(500)).length, 200);

// 2) the same problem is one row
const f = (message: string, path = "/p", source = "client", digest?: string) => fingerprintOf({ message, path, source, digest });
assert.equal(f("item 17 not found"), f("item 18 not found"), "numbers do not make a new problem");
assert.notEqual(f("item 17 not found"), f("item 17 not found", "/other"), "another page is another problem");
assert.notEqual(f("boom"), f("boom", "/p", "boundary"));
assert.equal(f("x", "/a", "boundary", "1234"), f("y", "/b", "boundary", "1234"), "a server digest identifies the problem by itself");
assert.ok(f("x", "/a", "boundary", "1234").startsWith("d:") && f("x").startsWith("h:"));

// 3) backup freshness words
const now = new Date("2026-10-20T00:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86400000);
assert.deepEqual(backupState(null, now), { state: "never", days: null });
assert.equal(backupState(ago(0), now).state, "ok");
assert.equal(backupState(ago(BACKUP_WARN_DAYS), now).state, "ok", "exactly 7 days is still fine");
assert.equal(backupState(ago(BACKUP_WARN_DAYS + 1), now).state, "old");
assert.equal(backupState(ago(BACKUP_DANGER_DAYS + 1), now).state, "stale");

// 4) audit log wording
assert.equal(auditLabel("user.delete"), "ลบสมาชิก");
assert.equal(auditLabel("something.new"), "something.new", "an unknown action is shown as it is");
assert.equal(auditLink("User", "u1"), "/admin/users/u1");
assert.equal(auditLink("School", "s1"), "/admin/schools/s1");
assert.equal(auditLink("Nothing", "x"), null);
assert.equal(auditLink("User", null), null);
assert.equal(auditMeta({ a: 1, b: null, c: "", d: { e: 1 } }), "a: 1 · d: {\"e\":1}");
assert.equal(auditMeta(null), "");

// 5) every action the code writes to the audit log has a Thai label (so a new action cannot silently appear as a raw key)
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p);
  }
};
walk("src");
walk("scripts");
const used = new Set<string>();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/action:\s*"([a-z0-9]+(?:[.-][a-z0-9]+)+)"/g)) used.add(m[1]);
  for (const m of text.matchAll(/action:\s*[^,}]*\?\s*"([a-z0-9.-]+)"\s*:\s*"([a-z0-9.-]+)"/g)) { for (const a of [m[1], m[2]]) if (a.includes(".")) used.add(a); } // only dotted keys: "update"/"create" elsewhere are not audit actions // a ? "x.y" : "x.z"
}
const missing = [...used].filter((a) => !(a in AUDIT_LABELS));
assert.deepEqual(missing, [], `actions without a Thai label: ${missing.join(", ")}`);

console.log(`ops: all groups passed (${used.size} audit actions labelled)`);
