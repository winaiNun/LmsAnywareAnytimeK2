/* Run with: npm run test:members */
import assert from "node:assert/strict";
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

console.log(`members: ${passed} passed`);
