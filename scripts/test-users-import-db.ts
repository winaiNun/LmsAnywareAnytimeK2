/* Needs the local database: npm run test:db  (creates and removes its own rows, all usernames start with "zz.imp") */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { mapUserHeaders, validateUserRows } from "../src/lib/users-import";
import { buildPreviewRows, commitRows, type CommitInput } from "../src/lib/users-import-db";

const db = new PrismaClient();
const HEAD = ["ชื่อผู้ใช้", "อีเมล", "คำนำหน้า", "ชื่อ", "นามสกุล", "ประเภท", "โรงเรียน", "ตำแหน่ง/ชั้น", "รหัสผ่าน"];

async function preview(rows: string[][]) {
  const schools = await db.school.findMany({ select: { id: true, code: true, name: true } });
  return buildPreviewRows(validateUserRows(rows, mapUserHeaders(HEAD).index, schools, 2));
}
const inputs = (rows: Awaited<ReturnType<typeof preview>>): CommitInput[] =>
  rows.filter((r) => r.action !== "error").map((r) => ({ username: r.username, email: r.email, prefix: r.prefix, firstName: r.firstName, lastName: r.lastName, memberType: r.memberType, schoolText: r.schoolLabel, schoolId: r.schoolId, organization: r.organization, position: r.position, gradeLevel: r.gradeLevel, password: r.password }));

async function main() {
  const school = await db.school.findFirstOrThrow({ orderBy: { code: "asc" } });
  const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const schoolAcct = await db.school.findFirst({ where: { accountId: { not: null } }, include: { account: true } });
  try {
    // 1) first import: three new members
    const file = [
      ["zz.imp1", "", "เด็กชาย", "สมชาย", "ทดสอบ", "นักเรียน", school.code, "ป.5", ""],
      ["zz.imp2", "zz.imp2@example.com", "นางสาว", "สมหญิง", "ทดสอบ", "ครู", school.name, "ครูชำนาญการ", "Typed-Pass-9"],
      ["", "zz.imp3@example.com", "นาย", "ประสิทธิ์", "ทดสอบ", "ศึกษานิเทศก์", "สพป.ทดสอบ", "ศน.", ""],
    ];
    let p = await preview(file);
    assert.deepEqual(p.map((r) => r.action), ["new", "new", "new"]);
    assert.deepEqual(p.map((r) => r.passwordPlan), ["generate", "file", "generate"]);
    let out = await commitRows(inputs(p), false);
    assert.deepEqual(out.map((o) => o.result), ["created", "created", "created"]);
    assert.equal(out.filter((o) => o.credential).length, 2, "typed password is not echoed back; the other two get temporary ones");
    const cred = out[0].credential!;
    const u1 = await db.user.findUniqueOrThrow({ where: { username: "zz.imp1" } });
    assert.equal(u1.memberType, "STUDENT");
    assert.equal(u1.schoolId, school.id);
    assert.equal(u1.gradeLevel, "ป.5");
    assert.equal(u1.role, "STUDENT");
    assert.equal(u1.mustChangePassword, true);
    assert.equal(await bcrypt.compare(cred.password, u1.passwordHash), true, "temporary password works");
    const u2 = await db.user.findUniqueOrThrow({ where: { username: "zz.imp2" } });
    assert.equal(await bcrypt.compare("Typed-Pass-9", u2.passwordHash), true, "typed password is used");
    const u3 = await db.user.findUniqueOrThrow({ where: { email: "zz.imp3@example.com" } });
    assert.equal(u3.organization, "สพป.ทดสอบ");
    assert.equal(u3.schoolId, null);

    // 2) same file again: nothing to do
    p = await preview(file);
    assert.deepEqual(p.map((r) => r.action), ["same", "same", "same"]);

    // 3) a member typed a phone number; the import updates the grade but must not wipe the phone or the password
    await db.user.update({ where: { id: u1.id }, data: { phone: "0812345678" } });
    file[0][7] = "ป.6";
    p = await preview(file);
    assert.equal(p[0].action, "update");
    assert.deepEqual(p[0].changes, ["ชั้น"]);
    out = await commitRows(inputs(p), false);
    assert.equal(out[0].result, "updated");
    const u1b = await db.user.findUniqueOrThrow({ where: { id: u1.id } });
    assert.equal(u1b.gradeLevel, "ป.6");
    assert.equal(u1b.phone, "0812345678", "phone survives an import update");
    assert.equal(u1b.passwordHash, u1.passwordHash, "password untouched without the reset option");
    assert.equal(out[0].credential, undefined);

    // 4) reset option issues a new temporary password and drops PINs
    await db.trustedDevice.create({ data: { userId: u1.id, tokenHash: "zz".repeat(32), pinHash: "x", label: "t" } });
    out = await commitRows(inputs(await preview(file)), true);
    assert.ok(out[0].credential);
    const u1c = await db.user.findUniqueOrThrow({ where: { id: u1.id } });
    assert.equal(await bcrypt.compare(out[0].credential!.password, u1c.passwordHash), true);
    assert.equal(await db.trustedDevice.count({ where: { userId: u1.id } }), 0);

    // 5) protected accounts and clashes are refused
    const bad = await preview([
      ["zz.imp9", admin.email ?? "", "", "ผู้ดูแล", "x", "ครู", school.code, "", ""], // e-mail of an ADMIN
      ["zz.imp1", "zz.imp2@example.com", "", "ชนกัน", "x", "ครู", school.code, "", ""], // username of one member, e-mail of another
      ...(schoolAcct?.account?.email ? [["zz.imp8", schoolAcct.account.email, "", "บัญชีโรงเรียน", "x", "ครู", school.code, "", ""]] : []),
    ]);
    assert.ok(bad.every((r) => r.action === "error"), JSON.stringify(bad.map((r) => [r.action, r.errors])));
    assert.match(bad[0].errors.join(), /ผู้ดูแล/);
    assert.match(bad[1].errors.join(), /คนละบัญชี/);
    if (schoolAcct) assert.match(bad[2].errors.join(), /โรงเรียน/);
    assert.equal(await db.user.count({ where: { username: "zz.imp9" } }), 0);

    // 6) the server re-validates: a tampered row (bad school id) is refused, nothing saved
    const forged = inputs(await preview([["zz.imp5", "", "", "ปลอม", "x", "นักเรียน", school.code, "", ""]]));
    forged[0].schoolId = "not-a-school";
    forged[0].schoolText = "ไม่มีจริง";
    out = await commitRows(forged, false);
    assert.equal(out[0].result, "error");
    assert.equal(await db.user.count({ where: { username: "zz.imp5" } }), 0);

    console.log("users-import db: 6 groups passed");
  } finally {
    await db.user.deleteMany({ where: { OR: [{ username: { startsWith: "zz.imp" } }, { email: { startsWith: "zz.imp" } }] } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
