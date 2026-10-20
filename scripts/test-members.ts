/* Run with: npm run test:members */
import assert from "node:assert/strict";
import { avatarBox, clampCenter } from "../src/lib/avatar";
import { CODE_LENGTH, codeStatus, formatCode, generateCode, normalizeCode } from "../src/lib/registration";
import { pinAllowed, pinProblem } from "../src/lib/pin";
import { AUTO_PREFIXES, PREFIXES, composePersonName, profileData, profileSchema, usernameField } from "../src/lib/members";

let passed = 0;
const t = (name: string, fn: () => void) => { try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${(e as Error).message}`); process.exitCode = 1; } };

const base = { firstName: "สมชาย", lastName: "ใจดี" };

t("student/teacher must pick a school", () => {
  assert.equal(profileSchema.safeParse({ ...base, memberType: "STUDENT" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "TEACHER", schoolId: "" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "TEACHER", schoolId: "s1" }).success, true);
});
t("supervisor needs an agency, general does not", () => {
  assert.equal(profileSchema.safeParse({ ...base, memberType: "SUPERVISOR" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "SUPERVISOR", organization: "สพป.นม.2" }).success, true);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "GENERAL" }).success, true);
});
t("school administrators belong to a school, district staff name an agency", () => {
  assert.equal(profileSchema.safeParse({ ...base, memberType: "SCHOOL_ADMIN" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "SCHOOL_ADMIN", schoolId: "s1" }).success, true);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "DISTRICT_STAFF" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "DISTRICT_STAFF", organization: "สพป.นม.2" }).success, true);
});
t("names are required, phone is checked", () => {
  assert.equal(profileSchema.safeParse({ memberType: "GENERAL", firstName: "", lastName: "x" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "GENERAL", phone: "abc" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "GENERAL", phone: "081-234-5678" }).success, true);
});
t("profileData clears fields a type does not use", () => {
  const p = profileSchema.parse({ ...base, memberType: "STUDENT", prefix: "เด็กชาย", schoolId: "s1", gradeLevel: "ป.5", organization: "x", position: "y" });
  const d = profileData(p);
  assert.equal(d.name, "เด็กชายสมชาย ใจดี");
  assert.equal(d.schoolId, "s1");
  assert.equal(d.organization, null);
  assert.equal(d.position, null);
  assert.equal(d.gradeLevel, "ป.5");
  const s = profileData(profileSchema.parse({ ...base, memberType: "SUPERVISOR", organization: "สพป.", gradeLevel: "ม.1", schoolId: "s1" }));
  assert.equal(s.schoolId, null);
  assert.equal(s.gradeLevel, null);
});
t("names: the title is attached to the first name (certificate rule)", () => {
  assert.equal(composePersonName("นาย", "วินัย", "หนุนกระโทก"), "นายวินัย หนุนกระโทก");
  assert.equal(composePersonName("นางสาว", "สมศรี", "รักเรียน"), "นางสาวสมศรี รักเรียน");
  assert.equal(composePersonName("ดร.", "สมชาย", "ใจดี"), "ดร.สมชาย ใจดี");
  assert.equal(composePersonName("ผศ.", "วิภา", "ใจดี"), "ผศ.วิภา ใจดี");
  assert.equal(composePersonName(null, "สมชาย", "ใจดี"), "สมชาย ใจดี");
  assert.equal(composePersonName("", "สมชาย", "ใจดี"), "สมชาย ใจดี");
  assert.equal(composePersonName("นาย ", "  วินัย ", " หนุนกระโทก  "), "นายวินัย หนุนกระโทก", "stray spaces are cleaned");
  assert.equal(composePersonName("นาย", "วินัย", ""), "นายวินัย");
  const p = profileData(profileSchema.parse({ memberType: "TEACHER", prefix: "นาง", firstName: "วิภา", lastName: "ใจดี", schoolId: "s1" }));
  assert.equal(p.name, "นางวิภา ใจดี");
});

t("titles: a list plus free text", () => {
  const base = { memberType: "GENERAL", firstName: "วินัย", lastName: "หนุนกระโทก" };
  for (const ok of ["นาย", "ว่าที่ร้อยตรี", "พล.ต.อ.", "ว่าที่ร.ต.หญิง", "พระครูสมุห์", "ม.ล.", "Dr.", "ศ.(พิเศษ)"]) {
    const r = profileSchema.safeParse({ ...base, prefix: ok });
    assert.equal(r.success, true, ok);
    assert.equal(profileData(r.data!).name, `${ok}วินัย หนุนกระโทก`);
  }
  assert.equal(profileSchema.safeParse({ ...base, prefix: "" }).data?.prefix, undefined);
  for (const bad of ["x".repeat(31), "<b>", "นาย1", "นาย;drop", "line\nbreak"]) assert.equal(profileSchema.safeParse({ ...base, prefix: bad }).success, false, bad);
  assert.equal(new Set(PREFIXES).size, PREFIXES.length, "no duplicates");
  assert.ok(PREFIXES.includes("ว่าที่ร้อยตรี") && PREFIXES.includes("พล.ต.อ.") && PREFIXES.includes("นางสาว"));
  assert.ok(AUTO_PREFIXES.every((p) => PREFIXES.includes(p)) && !AUTO_PREFIXES.includes("คุณ") && !AUTO_PREFIXES.includes("พระ"));
});

t("usernames", () => {
  assert.equal(usernameField.safeParse("Student01").data, "student01");
  assert.equal(usernameField.safeParse("ab").success, false);
  assert.equal(usernameField.safeParse("a b c").success, false);
  assert.equal(usernameField.safeParse("a@b.com").success, false);
});

t("pin rules", () => {
  assert.equal(pinProblem("482915"), null);
  for (const bad of ["12345", "1234567", "abcdef", "111111", "123456", "654321", "012345"]) assert.notEqual(pinProblem(bad), null, bad);
  assert.equal(pinAllowed("STUDENT"), true);
  assert.equal(pinAllowed("TEACHER"), true);
  assert.equal(pinAllowed("ADMIN"), false);
  assert.equal(pinAllowed("LIBRARIAN"), false);
});

t("avatar crop geometry", () => {
  // square image, no zoom: fills the circle exactly
  assert.deepEqual(avatarBox({ cx: 0.5, cy: 0.5, zoom: 1, aspect: 1 }), { width: "100%", height: "100%", left: "0%", top: "0%" });
  // 2x zoom on a square, centred: image is twice the viewport, shifted back by half the viewport
  assert.deepEqual(avatarBox({ cx: 0.5, cy: 0.5, zoom: 2, aspect: 1 }), { width: "200%", height: "200%", left: "-50%", top: "-50%" });
  // landscape 2:1, no zoom: height fills, width is 200%, centred horizontally
  assert.deepEqual(avatarBox({ cx: 0.5, cy: 0.5, zoom: 1, aspect: 2 }), { width: "200%", height: "100%", left: "-50%", top: "0%" });
  // window may not leave the image
  assert.deepEqual(clampCenter(0, 1, 2, 1), { cx: 0.25, cy: 0.75 });
  assert.deepEqual(clampCenter(0.5, 0.5, 1, 1), { cx: 0.5, cy: 0.5 });
  const c = clampCenter(0, 0.5, 1, 2); // landscape, zoom 1: window is half the width
  assert.equal(c.cx, 0.25);
});

t("registration codes", () => {
  const c = generateCode();
  assert.equal(c.length, CODE_LENGTH);
  assert.match(c, /^[A-HJKMNP-Z2-9]+$/); // no 0 O 1 I L
  assert.notEqual(generateCode(), generateCode());
  assert.equal(normalizeCode(" abcd-ef gh "), "ABCDEFGH");
  assert.equal(formatCode("ABCDEFGH"), "ABCD-EFGH");
  const now = new Date("2026-10-11T00:00:00Z");
  const base = { active: true, expiresAt: null, maxUses: null, usedCount: 0 };
  assert.equal(codeStatus(base, now), "ok");
  assert.equal(codeStatus({ ...base, active: false }, now), "inactive");
  assert.equal(codeStatus({ ...base, expiresAt: new Date("2026-10-10T00:00:00Z") }, now), "expired");
  assert.equal(codeStatus({ ...base, expiresAt: new Date("2026-10-12T00:00:00Z") }, now), "ok");
  assert.equal(codeStatus({ ...base, maxUses: 2, usedCount: 2 }, now), "used-up");
  assert.equal(codeStatus({ ...base, maxUses: 2, usedCount: 1 }, now), "ok");
});
t("sub-codes: the group code's switch, expiry and total limit apply to every sub-code", () => {
  const now = new Date("2026-10-11T00:00:00Z");
  const sub = { active: true, expiresAt: null, maxUses: null, usedCount: 0 };
  const group = { active: true, expiresAt: null, maxUses: null, usedCount: 0, groupUsed: 0 };
  assert.equal(codeStatus(sub, now, group), "ok");
  assert.equal(codeStatus(sub, now, { ...group, active: false }), "inactive", "group switched off");
  assert.equal(codeStatus(sub, now, { ...group, expiresAt: new Date("2026-10-10T00:00:00Z") }), "expired", "group expired");
  assert.equal(codeStatus(sub, now, { ...group, maxUses: 5, usedCount: 0, groupUsed: 5 }), "used-up", "group total reached (counted over all sub-codes, not the group's own count)");
  assert.equal(codeStatus(sub, now, { ...group, maxUses: 5, usedCount: 5, groupUsed: 4 }), "ok", "a group code's own count is not its limit");
  assert.equal(codeStatus({ ...sub, maxUses: 1, usedCount: 1 }, now, group), "used-up", "the sub-code's own limit");
  assert.equal(codeStatus({ ...sub, active: false }, now, group), "inactive");
  // a top-level code without sub-codes still behaves as before
  assert.equal(codeStatus({ ...group, maxUses: 2, usedCount: 2, groupUsed: 2 }, now), "used-up");
});

console.log(`members: ${passed} passed`);
