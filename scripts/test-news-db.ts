/* Needs the local database: npm run test:db (uses tabs whose name starts with "zznews" and removes them) */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { MAX_PAGE_SIZE, MIN_PAGE_SIZE, clampPageSize } from "../src/lib/news/merge";

const db = new PrismaClient();

async function cleanup() {
  await db.newsTab.deleteMany({ where: { name: { startsWith: "zznews" } } }); // items go with their tab
}

async function main() {
  await cleanup();
  try {
    // 1) defaults and ordering of tabs
    const a = await db.newsTab.create({ data: { name: "zznews A", sortOrder: 90 } });
    const b = await db.newsTab.create({ data: { name: "zznews B", sortOrder: 91, active: false } });
    assert.equal(a.pageSize, 8);
    assert.equal(a.active, true);
    const shown = await db.newsTab.findMany({ where: { active: true, name: { startsWith: "zznews" } }, orderBy: { sortOrder: "asc" } });
    assert.deepEqual(shown.map((t) => t.name), ["zznews A"], "a hidden tab is not listed");
    console.log("ok tabs");

    // 2) items: defaults per kind, only active ones are read
    const link = await db.newsItem.create({ data: { tabId: a.id, kind: "LINK", title: "zznews ลิงก์", url: "https://example.go.th/1", note: "หมายเหตุ", publishedAt: new Date("2026-10-01T00:00:00Z"), pinned: true } });
    const feed = await db.newsItem.create({ data: { tabId: a.id, kind: "FEED", title: "zznews ฟีด", url: "https://example.go.th/rss" } });
    await db.newsItem.create({ data: { tabId: a.id, kind: "LINK", title: "zznews ซ่อน", url: "https://example.go.th/2", active: false } });
    assert.equal(feed.feedLimit, 20);
    assert.equal(feed.feedCacheMin, 60);
    assert.equal(feed.pinned, false);
    assert.equal(link.pinned, true);
    const read = await db.newsTab.findMany({ where: { active: true, name: { startsWith: "zznews" } }, select: { id: true, items: { where: { active: true }, select: { id: true } } } });
    assert.deepEqual(read[0].items.map((i) => i.id).sort(), [link.id, feed.id].sort());
    console.log("ok items");

    // 3) the item must belong to a real tab
    await assert.rejects(() => db.newsItem.create({ data: { tabId: "no_such_tab", kind: "LINK", title: "x", url: "https://x.org" } }));
    console.log("ok tab required");

    // 4) deleting a tab deletes its items
    await db.newsItem.create({ data: { tabId: b.id, kind: "LINK", title: "zznews ใน B", url: "https://example.go.th/3" } });
    assert.equal(await db.newsItem.count({ where: { tabId: b.id } }), 1);
    await db.newsTab.delete({ where: { id: b.id } });
    assert.equal(await db.newsItem.count({ where: { tabId: b.id } }), 0, "items of a deleted tab are gone");
    assert.equal(await db.newsItem.count({ where: { tabId: a.id } }), 3, "other tabs keep theirs");
    console.log("ok cascade");

    // 5) a stored page size outside the range is read back inside it
    await db.newsTab.update({ where: { id: a.id }, data: { pageSize: 500 } });
    const stored = await db.newsTab.findUniqueOrThrow({ where: { id: a.id } });
    assert.equal(clampPageSize(stored.pageSize), MAX_PAGE_SIZE);
    await db.newsTab.update({ where: { id: a.id }, data: { pageSize: 1 } });
    assert.equal(clampPageSize((await db.newsTab.findUniqueOrThrow({ where: { id: a.id } })).pageSize), MIN_PAGE_SIZE);
    console.log("ok page size read back in range");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
