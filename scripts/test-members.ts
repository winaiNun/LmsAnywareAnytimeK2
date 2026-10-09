/* Run with: npm run test:members */
import assert from "node:assert/strict";
import { avatarBox, clampCenter } from "../src/lib/avatar";
import { pinAllowed, pinProblem } from "../src/lib/pin";
import { profileData, profileSchema, usernameField } from "../src/lib/members";

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
t("names are required, phone is checked", () => {
  assert.equal(profileSchema.safeParse({ memberType: "GENERAL", firstName: "", lastName: "x" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "GENERAL", phone: "abc" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, memberType: "GENERAL", phone: "081-234-5678" }).success, true);
});
t("profileData clears fields a type does not use", () => {
  const p = profileSchema.parse({ ...base, memberType: "STUDENT", prefix: "เด็กชาย", schoolId: "s1", gradeLevel: "ป.5", organization: "x", position: "y" });
  const d = profileData(p);
  assert.equal(d.name, "เด็กชาย สมชาย ใจดี");
  assert.equal(d.schoolId, "s1");
  assert.equal(d.organization, null);
  assert.equal(d.position, null);
  assert.equal(d.gradeLevel, "ป.5");
  const s = profileData(profileSchema.parse({ ...base, memberType: "SUPERVISOR", organization: "สพป.", gradeLevel: "ม.1", schoolId: "s1" }));
  assert.equal(s.schoolId, null);
  assert.equal(s.gradeLevel, null);
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

console.log(`members: ${passed} passed`);
