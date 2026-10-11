/* Needs the local database: npm run test:db (uses keys that start with "zz-rl:" and removes them) */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { clearHits, limitReached, rateLimitedDb, recordHit } from "../src/lib/rate-limit-db";
import { verifyTurnstile } from "../src/lib/turnstile";

const db = new PrismaClient();

async function main() {
  try {
    // 1) the 4th attempt of 3 allowed is refused; another key is unaffected
    const k = "zz-rl:a";
    const r = [];
    for (let i = 0; i < 4; i++) r.push(await rateLimitedDb(k, 3, 60_000));
    assert.deepEqual(r, [false, false, false, true]);
    assert.equal(await rateLimitedDb("zz-rl:other", 3, 60_000), false);

    // 2) attempts that fell out of the window no longer count
    await db.rateLimitHit.create({ data: { key: "zz-rl:old", createdAt: new Date(Date.now() - 20 * 60_000) } });
    assert.equal(await limitReached("zz-rl:old", 1, 15 * 60_000), false);
    assert.equal(await limitReached("zz-rl:old", 1, 30 * 60_000), true);

    // 3) failure counting: reached after `max` records, cleared by clearHits; a burst never gets more than max through
    const f = "zz-rl:fail";
    for (let i = 0; i < 2; i++) await recordHit(f);
    assert.equal(await limitReached(f, 3, 60_000), false);
    await recordHit(f);
    assert.equal(await limitReached(f, 3, 60_000), true);
    await clearHits(f);
    assert.equal(await limitReached(f, 3, 60_000), false);
    const burst = await Promise.all(Array.from({ length: 10 }, () => rateLimitedDb("zz-rl:burst", 5, 60_000)));
    assert.ok(burst.filter((x) => !x).length <= 5, "never lets more than max through, even at the same moment");
    assert.equal(await limitReached("zz-rl:burst", 10, 60_000), true); // all 10 were counted

    // 4) Turnstile: off (no secret) lets everything through; on, an empty/short token fails without calling Cloudflare
    const saved = process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    assert.equal(await verifyTurnstile(undefined), true);
    process.env.TURNSTILE_SECRET_KEY = "x";
    assert.equal(await verifyTurnstile(""), false);
    assert.equal(await verifyTurnstile(undefined), false);
    if (saved === undefined) delete process.env.TURNSTILE_SECRET_KEY; else process.env.TURNSTILE_SECRET_KEY = saved;
    console.log("rate limit db: 4 groups passed");
  } finally {
    await db.rateLimitHit.deleteMany({ where: { key: { startsWith: "zz-rl:" } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
