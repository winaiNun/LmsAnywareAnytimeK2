/* Needs the local database: npm run test:db (creates and removes its own rows: titles start with "zz-count") */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { bangkokDay, recordOpen, recordView, setLike, topViewedIds } from "../src/lib/media-counters";

const db = new PrismaClient();

async function main() {
  const owner = await db.user.create({ data: { username: "zz.count.owner", name: "zz owner", passwordHash: await bcrypt.hash("x-not-used-9", 4) } });
  const members = await Promise.all(Array.from({ length: 5 }, (_, i) => db.user.create({ data: { username: `zz.count.m${i}`, name: `zz m${i}`, passwordHash: "x" } })));
  const mk = (title: string, status: "PUBLISHED" | "PENDING" | "DRAFT" = "PUBLISHED") => db.media.create({ data: { title: `zz-count ${title}`, areaId: "area_math", createdById: owner.id, status, publishedAt: status === "PUBLISHED" ? new Date() : null } });
  try {
    // 1) Bangkok calendar day: 17:00 UTC is already "tomorrow" in Thailand
    assert.equal(bangkokDay(new Date("2026-10-11T16:59:00Z")).toISOString().slice(0, 10), "2026-10-11");
    assert.equal(bangkokDay(new Date("2026-10-11T17:00:00Z")).toISOString().slice(0, 10), "2026-10-12");

    // 2) 50 views at the same moment: the total and the daily bucket both end at exactly 50 (no lost updates, one bucket row)
    const a = await mk("a");
    const r = await Promise.all(Array.from({ length: 50 }, () => recordView(a.id)));
    assert.ok(r.every(Boolean));
    assert.equal((await db.media.findUniqueOrThrow({ where: { id: a.id } })).viewCount, 50);
    const buckets = await db.mediaViewDaily.findMany({ where: { mediaId: a.id } });
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0].views, 50);

    // 3) unpublished items never move a counter, and nothing is written
    const draft = await mk("draft", "DRAFT");
    const pending = await mk("pending", "PENDING");
    for (const m of [draft, pending]) {
      assert.equal(await recordView(m.id), false);
      assert.equal(await recordOpen(m.id), false);
    }
    assert.equal(await db.mediaViewDaily.count({ where: { mediaId: { in: [draft.id, pending.id] } } }), 0);
    assert.equal(await recordView("does-not-exist"), false);

    // 4) downloads
    await Promise.all([recordOpen(a.id), recordOpen(a.id), recordOpen(a.id)]);
    assert.equal((await db.media.findUniqueOrThrow({ where: { id: a.id } })).downloadCount, 3);

    // 5) likes: idempotent, never double counts, count always equals the rows
    const [m0, m1, m2] = members;
    assert.deepEqual(await setLike(m0.id, a.id, true), { liked: true, likeCount: 1 });
    assert.deepEqual(await setLike(m0.id, a.id, true), { liked: true, likeCount: 1 }, "liking twice is still one like");
    assert.deepEqual(await setLike(m1.id, a.id, true), { liked: true, likeCount: 2 });
    assert.deepEqual(await setLike(m0.id, a.id, false), { liked: false, likeCount: 1 });
    assert.deepEqual(await setLike(m0.id, a.id, false), { liked: false, likeCount: 1 }, "un-liking twice does not go below");
    assert.equal(await setLike(m0.id, draft.id, true), null, "cannot like an unpublished item");

    // 6) the same member clicking "like" 8 times at once -> exactly one like; 5 members at once -> 5 more
    await Promise.all(Array.from({ length: 8 }, () => setLike(m2.id, a.id, true)));
    await Promise.all(members.map((m) => setLike(m.id, a.id, true)));
    const likeRows = await db.mediaLike.count({ where: { mediaId: a.id } });
    const row = await db.media.findUniqueOrThrow({ where: { id: a.id } });
    assert.equal(likeRows, 5);
    assert.equal(row.likeCount, likeRows, "the counter equals the number of like rows");

    // 7) "most viewed in the last 30 days": recent beats old, only published, ties fall back to the all-time total
    const b = await mk("b");
    const c = await mk("c");
    await db.mediaViewDaily.createMany({ data: [
      { mediaId: b.id, day: bangkokDay(new Date(Date.now() - 5 * 86400000)), views: 500 }, // recent
      { mediaId: c.id, day: bangkokDay(new Date(Date.now() - 45 * 86400000)), views: 9999 }, // too old for the 30-day window
    ] });
    await db.mediaViewDaily.create({ data: { mediaId: draft.id, day: bangkokDay(), views: 100000 } }); // drafts are excluded
    const top = await topViewedIds(1000); // a wide limit: other (demo) media in the database must not push these out
    const mine = top.filter((id) => [a.id, b.id, c.id, draft.id].includes(id));
    assert.deepEqual(mine, [b.id, a.id], "b (500 recent) before a (50 today); c is outside the window; the draft is excluded");

    console.log("media counters db: 7 groups passed");
  } finally {
    await db.media.deleteMany({ where: { title: { startsWith: "zz-count" } } });
    await db.user.deleteMany({ where: { username: { startsWith: "zz.count." } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
