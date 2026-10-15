/* Needs the local database: npm run test:db (uses questions that start with "zzfaq" and removes them) */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { countFaqHit, logUnanswered } from "../src/lib/faq/store";
import { normaliseQuestion } from "../src/lib/faq/match";

const db = new PrismaClient();

async function cleanup() {
  await db.faqUnanswered.deleteMany({ where: { norm: { startsWith: "zzfaq" } } });
  await db.faqItem.deleteMany({ where: { question: { startsWith: "zzfaq" } } });
}

async function main() {
  await cleanup();
  try {
    // 1) twenty visitors ask the same thing at once (typed slightly differently) -> one row, count 20
    const variants = ["zzfaq ลืมรหัสผ่าน", "zzfaq  ลืม รหัสผ่าน!", "ZZFAQ ลืมรหัสผ่าน?"];
    await Promise.all(Array.from({ length: 20 }, (_, i) => logUnanswered(variants[i % 3])));
    const rows = await db.faqUnanswered.findMany({ where: { norm: { startsWith: "zzfaq" } } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].count, 20);
    assert.equal(rows[0].status, "OPEN");
    assert.equal(rows[0].norm, normaliseQuestion("zzfaq ลืมรหัสผ่าน"));
    console.log("ok concurrent counting");

    // 2) a different question is its own row; blank/over-long input is handled
    await logUnanswered("zzfaq เรื่องอื่น");
    await logUnanswered("   ");
    await logUnanswered("zzfaq " + "ก".repeat(500));
    const all = await db.faqUnanswered.findMany({ where: { norm: { startsWith: "zzfaq" } } });
    assert.equal(all.length, 3);
    assert.ok(all.every((r) => r.sample.length <= 200));
    console.log("ok separate rows / limits");

    // 3) status rules: DISMISSED stays dismissed (still counts); ANSWERED reopens
    const key = normaliseQuestion("zzfaq เรื่องอื่น");
    await db.faqUnanswered.update({ where: { norm: key }, data: { status: "DISMISSED" } });
    await logUnanswered("zzfaq เรื่องอื่น");
    let r = await db.faqUnanswered.findUniqueOrThrow({ where: { norm: key } });
    assert.equal(r.status, "DISMISSED");
    assert.equal(r.count, 2);
    await db.faqUnanswered.update({ where: { norm: key }, data: { status: "ANSWERED" } });
    await logUnanswered("zzfaq เรื่องอื่น");
    r = await db.faqUnanswered.findUniqueOrThrow({ where: { norm: key } });
    assert.equal(r.status, "OPEN");
    assert.equal(r.count, 3);
    console.log("ok status rules");

    // 4) hit counter: concurrent hits all count; a deleted item is not an error
    const item = await db.faqItem.create({ data: { question: "zzfaq คำถาม", answer: "คำตอบ" } });
    await Promise.all(Array.from({ length: 15 }, () => countFaqHit(item.id)));
    assert.equal((await db.faqItem.findUniqueOrThrow({ where: { id: item.id } })).hitCount, 15);
    await db.faqItem.delete({ where: { id: item.id } });
    await assert.doesNotReject(() => countFaqHit(item.id));
    console.log("ok hit counter");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
