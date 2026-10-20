/* Needs the local database: npm run test:db (creates rows whose ids start with "zzhn" and removes them). The point: privacy rules hold against real rows. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { loadHonorMembers } from "../src/lib/honors";

const db = new PrismaClient();
const P = "zzhn";

async function cleanup() {
  await db.media.deleteMany({ where: { id: { startsWith: P } } });
  await db.course.deleteMany({ where: { id: { startsWith: P } } });
  await db.school.deleteMany({ where: { id: { startsWith: P } } });
  await db.user.deleteMany({ where: { id: { startsWith: P } } });
}

type U = { id: string; memberType?: "TEACHER" | "STUDENT" | "GENERAL"; role?: "STUDENT" | "TEACHER" | "ADMIN" | "LIBRARIAN"; show?: boolean; hidden?: boolean; active?: boolean; photo?: boolean; school?: boolean; bio?: string };

async function main() {
  await cleanup();
  try {
    const area = await db.learningArea.findFirstOrThrow({ select: { id: true } });
    const users: U[] = [
      { id: `${P}ok`, memberType: "TEACHER", role: "TEACHER", show: true, bio: "สวัสดี" },
      { id: `${P}private`, memberType: "TEACHER", role: "TEACHER", show: true, photo: false, school: false },
      { id: `${P}student`, memberType: "STUDENT", role: "STUDENT", show: true }, // agreed in the DB, must never show
      { id: `${P}nocons`, memberType: "TEACHER", role: "TEACHER", show: false },
      { id: `${P}hidden`, memberType: "TEACHER", role: "TEACHER", show: true, hidden: true },
      { id: `${P}admin`, memberType: "TEACHER", role: "ADMIN", show: true },
      { id: `${P}off`, memberType: "TEACHER", role: "TEACHER", show: true, active: false },
      { id: `${P}schoolacct`, memberType: "GENERAL", role: "STUDENT", show: true },
      { id: `${P}general`, memberType: "GENERAL", role: "STUDENT", show: true },
    ];
    for (const u of users) {
      await db.user.create({
        data: {
          id: u.id, username: u.id, name: `ทดสอบ ${u.id}`, passwordHash: "x", memberType: u.memberType, role: u.role,
          showInHonors: u.show ?? false, honorsHidden: u.hidden ?? false, active: u.active ?? true,
          honorsShowPhoto: u.photo ?? true, honorsShowSchool: u.school ?? true, honorsBio: u.bio ?? null,
          avatarKey: "avatars/x.webp", organization: "หน่วยงานทดสอบ", position: "ตำแหน่งทดสอบ",
        },
      });
      // 3 published + 1 draft media and 1 published course each, so only the rules (not the counts) decide who is listed
      for (let k = 0; k < 4; k++) await db.media.create({ data: { id: `${u.id}m${k}`.replace(/^/, ""), title: "t", areaId: area.id, createdById: u.id, status: k < 3 ? "PUBLISHED" : "DRAFT", publishedAt: k < 3 ? new Date() : null, likeCount: 2, viewCount: 5 } });
      await db.course.create({ data: { id: `${u.id}c`, title: "c", areaId: area.id, createdById: u.id, status: "PUBLISHED", publishedAt: new Date() } });
    }
    // a school account must not be ranked
    const school = await db.school.create({ data: { id: `${P}school`, code: `${P}code`, name: "ร.ร.ทดสอบ", district: "ก", center: "ข", accountId: `${P}schoolacct` } });
    assert.ok(school.id);

    const all = await loadHonorMembers("all");
    const mine = all.filter((m) => m.id.startsWith(P));
    const ids = mine.map((m) => m.id).sort();
    assert.deepEqual(ids, [`${P}general`, `${P}ok`, `${P}private`].sort(), "only agreed, visible, non-student, non-staff, non-school members are listed");
    console.log("ok eligibility (student / not agreed / hidden / admin / disabled / school account are all excluded)");

    const ok = mine.find((m) => m.id === `${P}ok`)!;
    assert.equal(ok.mediaCount, 3, "drafts are not counted");
    assert.equal(ok.courseCount, 1);
    assert.equal(ok.likes, 6);
    assert.equal(ok.bio, "สวัสดี");
    assert.ok(ok.avatar || ok.avatar === null);
    assert.equal(ok.subtitle, "หน่วยงานทดสอบ");
    assert.equal(ok.position, "ตำแหน่งทดสอบ");
    console.log("ok counts only published work");

    const priv = mine.find((m) => m.id === `${P}private`)!;
    assert.equal(priv.avatar, null, "photo hidden by the member");
    assert.equal(priv.subtitle, null, "school hidden by the member");
    assert.equal(priv.position, null);
    // nothing else about the member leaks into the public shape
    const keys = Object.keys(ok).sort().join(",");
    assert.equal(keys, "avatar,badges,bio,courseCount,id,joinedAt,likes,mediaCount,name,position,subtitle,views");
    console.log("ok the member's own choices are respected and no private field is in the public shape");

    // the academic-year period only counts work published since 16 May
    await db.media.updateMany({ where: { id: { startsWith: `${P}ok` } }, data: { publishedAt: new Date("2020-01-01T00:00:00Z") } });
    const year = (await loadHonorMembers("year")).find((m) => m.id === `${P}ok`)!;
    assert.equal(year.mediaCount, 0, "old media are outside this academic year");
    assert.equal(year.courseCount, 1);
    console.log("ok academic-year period");

    // switching consent off removes the member at once
    await db.user.update({ where: { id: `${P}ok` }, data: { showInHonors: false } });
    assert.equal((await loadHonorMembers("all")).some((m) => m.id === `${P}ok`), false);
    console.log("ok withdrawing consent removes the member");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
