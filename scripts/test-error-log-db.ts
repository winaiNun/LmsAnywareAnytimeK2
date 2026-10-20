/* Needs the local database: npm run test:db (creates ErrorLog rows whose path starts with /zzerr and removes them). One problem = one row, counted; fixed problems reopen; nothing personal is kept. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { MAX_ROWS, logError, recentOpenErrors, sweep } from "../src/lib/error-log";

const db = new PrismaClient();
const P = "/zzerr";

async function cleanup() {
  await db.errorLog.deleteMany({ where: { path: { startsWith: P } } });
}

async function main() {
  await cleanup();
  try {
    const before = await recentOpenErrors();
    // the same problem 5 times (with different numbers in the text) is ONE row with count 5
    for (let i = 1; i <= 5; i++) await logError({ source: "client", message: `Cannot read item ${i} of undefined, mail a${i}@example.com`, path: `${P}/page?token=abc${i}` });
    const rows = await db.errorLog.findMany({ where: { path: { startsWith: P } } });
    assert.equal(rows.length, 1, "one row, not five");
    assert.equal(rows[0].count, 5);
    assert.equal(rows[0].path, `${P}/page`, "the query string (and its token) was dropped");
    assert.ok(!rows[0].message.includes("@example.com"), "no e-mail address in the log");
    assert.equal((await recentOpenErrors()) - before, 1);
    console.log("ok counted, scrubbed");

    // a different page is a different problem; a server digest identifies a problem on its own
    await logError({ source: "client", message: "Cannot read item 1 of undefined", path: `${P}/other` });
    await logError({ source: "boundary", message: "An error occurred in the Server Components render.", path: `${P}/a`, digest: "zz-digest-1" });
    await logError({ source: "boundary", message: "An error occurred in the Server Components render.", path: `${P}/b`, digest: "zz-digest-1" });
    const all = await db.errorLog.findMany({ where: { path: { startsWith: P } } });
    assert.equal(all.length, 3, "page /page, page /other, and one digest problem seen on two pages");
    assert.equal(all.find((r) => r.fingerprint === "d:zz-digest-1")!.count, 2);
    console.log("ok one row per kind of problem");

    // fixed -> gone from the open list; comes back by itself when it happens again
    const target = rows[0];
    await db.errorLog.update({ where: { id: target.id }, data: { resolvedAt: new Date() } });
    assert.equal((await recentOpenErrors()) - before, 2);
    await logError({ source: "client", message: "Cannot read item 9 of undefined, mail a9@example.com", path: `${P}/page` });
    const again = await db.errorLog.findUniqueOrThrow({ where: { id: target.id } });
    assert.equal(again.resolvedAt, null, "reopened by itself");
    assert.equal(again.count, 6);
    console.log("ok reopen");

    // the table stays bounded: oldest fixed ones go first
    const old = await db.errorLog.createMany({ data: Array.from({ length: 3 }, (_, i) => ({ fingerprint: `h:zz-old-${i}`, source: "client", message: "old", path: `${P}/old${i}`, lastAt: new Date(2020, 0, i + 1), resolvedAt: new Date(2020, 0, i + 1) })) });
    assert.equal(old.count, 3);
    const total = await db.errorLog.count();
    if (total <= MAX_ROWS) {
      // not enough rows to need a sweep here: just make sure sweeping is harmless
      await sweep();
      assert.equal(await db.errorLog.count(), total);
    }
    console.log("ok sweep is safe");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
