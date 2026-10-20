import assert from "node:assert/strict";
import { ELIGIBLE_WHERE, academicYearStart, honorBadges, isHonorEligible, rankHonors, shuffled, type HonorCandidate } from "../src/lib/honors-rank";
import { bangkokParts } from "../src/lib/thai-date";

// 1) eligibility: students never, opt-in only, admin can hide, staff/school accounts out
const ok: HonorCandidate = { memberType: "TEACHER", role: "TEACHER", active: true, showInHonors: true, honorsHidden: false, managesSchool: false };
assert.equal(isHonorEligible(ok), true);
assert.equal(isHonorEligible({ ...ok, memberType: "STUDENT" }), false, "student member type");
assert.equal(isHonorEligible({ ...ok, memberType: "STUDENT", role: "STUDENT", showInHonors: true }), false, "student even when the flag is on");
assert.equal(isHonorEligible({ ...ok, showInHonors: false }), false, "no consent");
assert.equal(isHonorEligible({ ...ok, honorsHidden: true }), false, "hidden by an admin");
assert.equal(isHonorEligible({ ...ok, active: false }), false, "disabled account");
assert.equal(isHonorEligible({ ...ok, role: "ADMIN" }), false);
assert.equal(isHonorEligible({ ...ok, role: "LIBRARIAN" }), false);
assert.equal(isHonorEligible({ ...ok, managesSchool: true }), false);
assert.equal(isHonorEligible({ ...ok, memberType: "SUPERVISOR", role: "STUDENT" }), true, "ordinary members have the STUDENT role");
// the SQL filter says the same thing
assert.deepEqual(ELIGIBLE_WHERE.memberType, { not: "STUDENT" });
assert.equal(ELIGIBLE_WHERE.showInHonors, true);
assert.equal(ELIGIBLE_WHERE.honorsHidden, false);
assert.deepEqual(ELIGIBLE_WHERE.role.in.slice().sort(), ["STUDENT", "TEACHER"]);

// 2) ranking
const now = new Date("2026-10-20T05:00:00Z");
const d = (days: number) => new Date(now.getTime() - days * 86400000);
const row = (id: string, name: string, mediaCount: number, courseCount: number, likes = 0, views = 0, joined = 400) => ({ id, name, mediaCount, courseCount, likes, views, joinedAt: d(joined) });
const rows = [row("a", "ก", 5, 0, 10), row("b", "ข", 9, 1, 3), row("c", "ค", 0, 4), row("d", "ง", 0, 0), row("e", "จ", 9, 0, 50, 0, 30), row("f", "ฉ", 2, 2, 0, 900, 10)];
const ids = (l: { id: string }[]) => l.map((x) => x.id).join("");
assert.equal(ids(rankHonors(rows, "media", { minItems: 1, now })), "ebaf", "media: 9 (more likes first), 9, 5, 2; zero is not ranked");
assert.equal(ids(rankHonors(rows, "courses", { minItems: 1, now })), "cfb", "courses: 4, 2, 1");
assert.equal(ids(rankHonors(rows, "likes", { minItems: 1, now })), "eab", "likes");
assert.equal(ids(rankHonors(rows, "views", { minItems: 1, now })), "f", "views");
assert.equal(ids(rankHonors(rows, "rising", { minItems: 1, now })), "fe", "joined in the last 90 days, with work, newest first");
assert.equal(ids(rankHonors(rows, "all", { minItems: 1, now })).length, 6, "all lists every consenting member, even with no work");
assert.equal(ids(rankHonors(rows, "media", { minItems: 6, now })), "eb", "minimum number of items to be ranked");
assert.equal(ids(rankHonors(rows, "media", { minItems: 0, now })), "ebaf", "a minimum of 0 still needs at least 1 item");
// stable order for ties
const tie = [row("x", "บ", 3, 0, 0, 0, 100), row("y", "ก", 3, 0, 0, 0, 200)];
assert.equal(ids(rankHonors(tie, "media", { minItems: 1, now })), "yx", "tie: earlier join first");

// 3) badges
assert.deepEqual(honorBadges({ mediaCount: 0, courseCount: 0, likes: 0 }), []);
assert.deepEqual(honorBadges({ mediaCount: 10, courseCount: 3, likes: 100 }).map((b) => b.key), ["media1", "media10", "course1", "course3", "likes100"]);

// 4) academic year starts on 16 May (Bangkok time)
const start = (iso: string) => bangkokParts(academicYearStart(new Date(iso)));
assert.deepEqual([start("2026-10-20T05:00:00Z").year, start("2026-10-20T05:00:00Z").month, start("2026-10-20T05:00:00Z").day], [2026, 5, 16]);
assert.equal(start("2026-05-15T10:00:00Z").year, 2025, "15 May is still last year");
assert.equal(start("2026-05-16T00:00:00Z").year, 2026, "16 May starts the new year");
assert.equal(start("2027-01-02T05:00:00Z").year, 2026, "January belongs to the year that began the previous May");

// 5) shuffle keeps the same members and does not change the input
const src = [1, 2, 3, 4, 5, 6];
const sh = shuffled(src);
assert.deepEqual([...sh].sort(), src);
assert.deepEqual(src, [1, 2, 3, 4, 5, 6]);
let seq = 0;
assert.deepEqual(shuffled([1, 2, 3], () => (seq++ % 2 ? 0.99 : 0)), shuffled([1, 2, 3], (() => { let k = 0; return () => (k++ % 2 ? 0.99 : 0); })()));

console.log("honors: all groups passed");
