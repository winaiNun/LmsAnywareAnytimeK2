/* Needs the local database: npm run test:db (creates rows whose ids start with "zzaud" and removes them). Real rows: who may enrol in a course made "only for ...". */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { enrollAs } from "../src/lib/course/course-review";

const db = new PrismaClient();
const P = "zzaud";

async function cleanup() {
  await db.enrollment.deleteMany({ where: { courseId: { startsWith: P } } });
  await db.course.deleteMany({ where: { id: { startsWith: P } } });
  await db.user.deleteMany({ where: { id: { startsWith: P } } });
}

async function main() {
  await cleanup();
  try {
    const area = await db.learningArea.findFirstOrThrow({ select: { id: true } });
    const mk = (id: string, memberType: "TEACHER" | "SCHOOL_ADMIN" | "DISTRICT_STAFF", role: "STUDENT" | "ADMIN" = "STUDENT", active = true) =>
      db.user.create({ data: { id: `${P}${id}`, username: `${P}${id}`, name: id, passwordHash: "x", memberType, role, active } });
    await Promise.all([mk("teacher", "TEACHER"), mk("principal", "SCHOOL_ADMIN"), mk("district", "DISTRICT_STAFF"), mk("admin", "TEACHER", "ADMIN"), mk("off", "SCHOOL_ADMIN", "STUDENT", false)]);
    const course = (id: string, audienceTypes: ("SCHOOL_ADMIN" | "DISTRICT_STAFF")[], audienceOnly: boolean) =>
      db.course.create({ data: { id: `${P}${id}`, title: id, areaId: area.id, createdById: `${P}district`, status: "PUBLISHED", publishedAt: new Date(), audienceTypes, audienceOnly } });
    await Promise.all([course("open", [], false), course("rec", ["SCHOOL_ADMIN"], false), course("only", ["SCHOOL_ADMIN", "DISTRICT_STAFF"], true)]);

    const ok = async (u: string, c: string) => "ok" in (await enrollAs(`${P}${u}`, `${P}${c}`));
    assert.equal(await ok("teacher", "open"), true, "no audience: anyone");
    assert.equal(await ok("teacher", "rec"), true, "recommended: anyone");
    const blocked = await enrollAs(`${P}teacher`, `${P}only`);
    assert.ok("error" in blocked && /เฉพาะกลุ่มเป้าหมาย/.test(blocked.error), "restricted: a teacher is refused with a clear message");
    assert.equal(await ok("principal", "only"), true, "restricted: the school administrator may join");
    assert.equal(await ok("district", "only"), true, "restricted: the second listed type may join");
    assert.equal(await ok("admin", "only"), true, "restricted: admins are never blocked");
    assert.equal(await ok("principal", "only"), true, "joining twice is harmless");
    assert.equal(await db.enrollment.count({ where: { courseId: `${P}only` } }), 3, "exactly the three allowed members are enrolled");
    assert.equal(await ok("off", "open"), false, "a disabled account cannot enrol");
    await db.course.update({ where: { id: `${P}only` }, data: { enrollOpen: false } });
    assert.equal(await ok("principal", "only"), true, "someone already enrolled stays enrolled");
    console.log("ok course audience enrolment");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
