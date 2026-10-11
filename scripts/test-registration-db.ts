/* Needs the local database: npm run test:db  (creates and removes its own rows) */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { generateCode, redeemCode } from "../src/lib/registration";

const db = new PrismaClient();
const mk = (data: Partial<Parameters<typeof db.registrationCode.create>[0]["data"]> = {}) =>
  db.registrationCode.create({ data: { code: generateCode(), label: "__test__", memberType: "STUDENT", ...data } });
const use = (id: string) => db.$transaction((tx) => redeemCode(tx, id));
const used = async (id: string) => (await db.registrationCode.findUniqueOrThrow({ where: { id } })).usedCount;

async function main() {
  try {
    // 1) two people grab the last seat at the same moment: exactly one wins
    const one = await mk({ maxUses: 1 });
    const r = await Promise.all([use(one.id), use(one.id)]);
    assert.deepEqual(r.filter(Boolean).length, 1, "only one of two parallel redeems may succeed");
    assert.equal(await used(one.id), 1);

    // 2) 10 parallel redeems of a 3-seat code: exactly 3 succeed
    const three = await mk({ maxUses: 3 });
    const ten = await Promise.all(Array.from({ length: 10 }, () => use(three.id)));
    assert.equal(ten.filter(Boolean).length, 3);
    assert.equal(await used(three.id), 3);

    // 3) unlimited codes keep counting
    const free = await mk();
    await Promise.all([use(free.id), use(free.id), use(free.id)]);
    assert.equal(await used(free.id), 3);

    // 4) expired / disabled codes can not be used and are not counted
    const expired = await mk({ expiresAt: new Date(Date.now() - 1000) });
    assert.equal(await use(expired.id), false);
    const off = await mk({ active: false });
    assert.equal(await use(off.id), false);
    assert.equal(await used(expired.id) + (await used(off.id)), 0);

    // 5) a rolled-back sign-up gives the seat back
    const rb = await mk({ maxUses: 1 });
    await db.$transaction(async (tx) => { assert.equal(await redeemCode(tx, rb.id), true); throw new Error("rollback"); }).catch(() => {});
    assert.equal(await used(rb.id), 0);
    assert.equal(await use(rb.id), true);

    console.log("registration db: 5 groups passed");
  } finally {
    await db.registrationCode.deleteMany({ where: { label: "__test__" } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
