/* Needs the local database: npm run test:db (creates a user and courses whose ids/titles start with "zzdue" and removes them). Saving the "must take" / "finish by" settings. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { saveCourseInfoAs } from "../src/lib/course/course-save";
import type { CourseActor } from "../src/lib/course/access";
import { bangkokParts, endOfDayBangkok } from "../src/lib/thai-date";

const db = new PrismaClient();
const P = "zzdue";

async function cleanup() {
  await db.course.deleteMany({ where: { title: { startsWith: P } } });
  await db.user.deleteMany({ where: { id: { startsWith: P } } });
}

async function main() {
  await cleanup();
  try {
    const area = await db.learningArea.findFirstOrThrow({ select: { id: true } });
    await db.user.create({ data: { id: `${P}admin`, username: `${P}admin`, name: "admin", passwordHash: "x", role: "ADMIN", memberType: "DISTRICT_STAFF" } });
    const actor: CourseActor = { id: `${P}admin`, role: "ADMIN", reviewerAreaIds: [] };
    const save = (id: string | null, over: Record<string, unknown>) => {
      const fd = new FormData();
      fd.set("payload", JSON.stringify({ title: `${P} course`, description: "คำอธิบายคอร์สทดสอบ", areaId: area.id, levelIds: [], instructorName: "", hours: null, enrollOpen: true, cover: { mode: "none", fx: 0.5, fy: 0.5 }, ...over }));
      return saveCourseInfoAs(actor, id, fd);
    };
    const err = async (over: Record<string, unknown>) => { const r = await save(null, over); return "error" in r ? r.error : ""; };

    assert.match(await err({ mandatory: true }), /เลือกกลุ่มเป้าหมาย/, "must-take needs an audience");
    assert.match(await err({ mandatory: true, audienceTypes: ["STUDENT", "SCHOOL_ADMIN"] }), /นักเรียน/, "never for students");
    assert.match(await err({ dueAt: "2020-01-01" }), /อนาคต/, "a new due date must be ahead");
    assert.match(await err({ dueAt: "not a date" }), /ไม่ถูกต้อง/);
    assert.equal(await db.course.count({ where: { title: { startsWith: P } } }), 0, "refused saves leave nothing behind");
    console.log("ok validation");

    const day = new Date(Date.now() + 10 * 86400000);
    const iso = `${bangkokParts(day).year}-${String(bangkokParts(day).month).padStart(2, "0")}-${String(bangkokParts(day).day).padStart(2, "0")}`;
    const r = await save(null, { mandatory: true, audienceTypes: ["SCHOOL_ADMIN"], dueAt: iso });
    assert.ok("ok" in r && r.ok, JSON.stringify(r));
    const c = await db.course.findFirstOrThrow({ where: { title: { startsWith: P } } });
    assert.equal(c.mandatory, true);
    const p = bangkokParts(c.dueAt!);
    assert.deepEqual([p.hour, p.minute], [23, 59], "the due date is the end of the chosen day, Bangkok time");
    console.log("ok saved as end of day");

    // saving again with the unchanged date works even after that date would have passed; a changed date must be in the future
    const same = await save(c.id, { mandatory: true, audienceTypes: ["SCHOOL_ADMIN"], dueAt: c.dueAt!.toISOString() });
    assert.ok("ok" in same && same.ok, "an unchanged due date is accepted");
    await db.course.update({ where: { id: c.id }, data: { dueAt: endOfDayBangkok(new Date(Date.now() - 3 * 86400000)) } }); // what a saved date looks like once it has passed
    const past = await save(c.id, { mandatory: true, audienceTypes: ["SCHOOL_ADMIN"], dueAt: (await db.course.findUniqueOrThrow({ where: { id: c.id } })).dueAt!.toISOString() });
    assert.ok("ok" in past && past.ok, "editing other things of a course whose date has passed is not blocked");
    assert.match((await save(c.id, { mandatory: true, audienceTypes: ["SCHOOL_ADMIN"], dueAt: "2020-01-01" }) as { error?: string }).error ?? "", /อนาคต/, "but a changed date must be ahead");
    // switching both off clears them
    const off = await save(c.id, {});
    assert.ok("ok" in off && off.ok);
    const after = await db.course.findUniqueOrThrow({ where: { id: c.id } });
    assert.deepEqual([after.mandatory, after.dueAt], [false, null], "switching them off clears both");
    console.log("ok unchanged / changed / cleared");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
