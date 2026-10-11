/* Pure parsing tests: npm run test:members runs these too. DB round-trip: npm run test:db */
import assert from "node:assert/strict";
import { mapUserHeaders, parseMemberType, resolveSchool, splitFullName, validateUserRows, type SchoolRef } from "../src/lib/users-import";

let passed = 0;
const t = (name: string, fn: () => void) => { try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${(e as Error).message}`); process.exitCode = 1; } };

const schools: SchoolRef[] = [
  { id: "s1", code: "30020009", name: "โรงเรียนบ้านตัวอย่าง" },
  { id: "s2", code: "30020010", name: "โรงเรียนวัดสอง" },
  { id: "s3", code: "30020011", name: "โรงเรียนบ้านซ้ำ" },
  { id: "s4", code: "30020012", name: "โรงเรียนบ้านซ้ำ" },
];
const HEAD = ["ชื่อผู้ใช้/รหัสประจำตัว", "อีเมล", "คำนำหน้า", "ชื่อ", "นามสกุล", "ประเภท", "โรงเรียน", "ตำแหน่ง/ชั้น", "รหัสผ่าน"];
const run = (rows: string[][]) => validateUserRows(rows, mapUserHeaders(HEAD).index, schools, 2);

t("headers map from the template and from variants", () => {
  const m = mapUserHeaders(HEAD);
  assert.deepEqual(m.missing, []);
  assert.deepEqual(m.index, { username: 0, email: 1, prefix: 2, firstName: 3, lastName: 4, memberType: 5, school: 6, posGrade: 7, password: 8 });
  const v = mapUserHeaders(["รหัสนักเรียน", "ชื่อ-นามสกุล", "ประเภทสมาชิก", "ชั้น", "โรงเรียน"]);
  assert.deepEqual(v.missing, []);
  assert.equal(v.index.fullName, 1);
  assert.deepEqual(mapUserHeaders(["อีเมล", "ชื่อ"]).missing.length, 2); // no names pair, no type
});

t("member type wording", () => {
  assert.equal(parseMemberType("นักเรียน"), "STUDENT");
  assert.equal(parseMemberType("ครู"), "TEACHER");
  assert.equal(parseMemberType("บุคลากร"), "TEACHER");
  assert.equal(parseMemberType("ศึกษานิเทศก์"), "SUPERVISOR");
  assert.equal(parseMemberType("บุคคลทั่วไป"), "GENERAL");
  assert.equal(parseMemberType("teacher"), "TEACHER");
  assert.equal(parseMemberType("นักบิน"), null);
});

t("school lookup by code, by name, ambiguity", () => {
  assert.equal((resolveSchool("30020009", schools) as SchoolRef).id, "s1");
  assert.equal((resolveSchool("30020009.0", schools) as SchoolRef).id, "s1"); // Excel numbers
  assert.equal((resolveSchool("บ้านตัวอย่าง", schools) as SchoolRef).id, "s1"); // without "โรงเรียน"
  assert.equal((resolveSchool(" โรงเรียน  วัดสอง ", schools) as SchoolRef).id, "s2");
  assert.equal(resolveSchool("โรงเรียนบ้านซ้ำ", schools), "ambiguous");
  assert.equal(resolveSchool("โรงเรียนไม่มี", schools), null);
});

t("full names are split with the prefix", () => {
  assert.deepEqual(splitFullName("นางสาวสมหญิง ใจดี"), { prefix: "นางสาว", first: "สมหญิง", last: "ใจดี" });
  assert.deepEqual(splitFullName("เด็กชาย สมชาย รักเรียน"), { prefix: "เด็กชาย", first: "สมชาย", last: "รักเรียน" });
  assert.deepEqual(splitFullName("สมศักดิ์"), { prefix: null, first: "สมศักดิ์", last: "" });
});

t("a good student row and a good supervisor row", () => {
  const [s, sup] = run([
    ["65001", "", "เด็กชาย", "สมชาย", "ใจดี", "นักเรียน", "30020009", "ป.5", ""],
    ["", "Sup@Example.go.th", "นาย", "ประสิทธิ์", "นิเทศดี", "ศึกษานิเทศก์", "สพป.นม.2", "ศน.ชำนาญการ", "Passw0rd!x"],
  ]);
  assert.deepEqual(s.errors, []);
  assert.equal(s.username, "65001");
  assert.equal(s.schoolId, "s1");
  assert.equal(s.gradeLevel, "ป.5");
  assert.equal(s.position, null);
  assert.deepEqual(sup.errors, []);
  assert.equal(sup.email, "sup@example.go.th");
  assert.equal(sup.organization, "สพป.นม.2");
  assert.equal(sup.schoolId, null);
  assert.equal(sup.position, "ศน.ชำนาญการ");
  assert.equal(sup.password, "Passw0rd!x");
});

t("problems are reported per row", () => {
  const r = run([
    ["65001", "", "", "สมชาย", "ใจดี", "นักเรียน", "30020009", "", ""], // ok
    ["65001", "", "", "ซ้ำ", "คนใหม่", "นักเรียน", "30020009", "", ""], // duplicate username
    ["", "", "", "ไม่มีล็อกอิน", "x", "ครู", "30020009", "", ""],
    ["ab", "", "", "สั้น", "x", "ครู", "30020009", "", ""], // username too short
    ["t.1", "ไม่ใช่อีเมล", "", "เมล", "x", "ครู", "30020009", "", ""],
    ["t.2", "", "", "ไม่มีรร", "x", "ครู", "", "", ""],
    ["t.3", "", "", "รร.ผิด", "x", "ครู", "โรงเรียนที่ไม่มี", "", ""],
    ["t.4", "", "", "รร.ซ้ำ", "x", "ครู", "โรงเรียนบ้านซ้ำ", "", ""],
    ["t.5", "", "", "ประเภทผิด", "x", "นักบิน", "30020009", "", ""],
    ["t.6", "", "", "ไม่มีนามสกุล", "", "ครู", "30020009", "", ""],
    ["t.7", "", "", "รหัสสั้น", "x", "ครู", "30020009", "", "123"],
    ["t.8", "", "", "ศน.ไม่มีหน่วย", "x", "ศึกษานิเทศก์", "", "", ""],
  ]);
  assert.equal(r[0].errors.length, 0);
  assert.match(r[1].errors.join(), /ซ้ำกับแถว 2/);
  assert.match(r[2].errors.join(), /ชื่อผู้ใช้หรืออีเมล/);
  assert.match(r[3].errors.join(), /3–30/);
  assert.match(r[4].errors.join(), /อีเมล/);
  assert.match(r[5].errors.join(), /ไม่ระบุโรงเรียน/);
  assert.match(r[6].errors.join(), /ไม่พบโรงเรียน/);
  assert.match(r[7].errors.join(), /มากกว่าหนึ่งแห่ง/);
  assert.match(r[8].errors.join(), /ไม่รู้จัก/);
  assert.match(r[9].errors.join(), /นามสกุล/);
  assert.match(r[10].errors.join(), /8–100/);
  assert.match(r[11].errors.join(), /หน่วยงาน/);
  assert.equal(r.filter((x) => x.errors.length === 0).length, 1);
});

t("blank rows are skipped and line numbers stay right", () => {
  const r = run([["", "", "", "", "", "", "", "", ""], ["65002", "", "", "ก", "ข", "นักเรียน", "30020010", "ม.1", ""]]);
  assert.equal(r.length, 1);
  assert.equal(r[0].line, 3);
});

t("full-name column works when first/last columns are absent", () => {
  const idx = mapUserHeaders(["ชื่อผู้ใช้", "ชื่อ-นามสกุล", "ประเภท", "โรงเรียน"]).index;
  const [r] = validateUserRows([["u.one", "นางสาวสมหญิง ใจดี", "ครู", "30020010"]], idx, schools, 2);
  assert.deepEqual(r.errors, []);
  assert.equal(r.prefix, "นางสาว");
  assert.equal(r.firstName, "สมหญิง");
  assert.equal(r.lastName, "ใจดี");
});

console.log(`users-import: ${passed} passed`);
