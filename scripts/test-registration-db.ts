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

    // 6) a group code with sub-codes: the group's limit counts the sign-ups through ALL of them, atomically
    const useSub = (id: string, parentId: string) => db.$transaction(async (tx) => { if (!(await redeemCode(tx, id, parentId))) throw new Error("refused"); return true; }).catch(() => false);
    const group = await mk({ maxUses: 3 });
    const a = await mk({ parentId: group.id });
    const b = await mk({ parentId: group.id });
    const mix = await Promise.all([...Array.from({ length: 5 }, () => useSub(a.id, group.id)), ...Array.from({ length: 5 }, () => useSub(b.id, group.id)), use(group.id), use(group.id)]);
    assert.equal(mix.filter(Boolean).length, 3, "exactly 3 sign-ups in total across the group and its sub-codes");
    const g = await db.registrationCode.findUniqueOrThrow({ where: { id: group.id } });
    assert.equal(g.groupUsed, 3);
    const parts = (await used(group.id)) + (await used(a.id)) + (await used(b.id));
    assert.equal(parts, 3, "the sub-codes' own counts add up to the group total (refused sign-ups left no trace)");

    // 7) a sub-code has its own limit too, and the group's switch / expiry stop every sub-code
    const g2 = await mk();
    const c1 = await mk({ parentId: g2.id, maxUses: 1 });
    assert.deepEqual([await useSub(c1.id, g2.id), await useSub(c1.id, g2.id)], [true, false], "the sub-code's own limit of 1");
    assert.equal((await db.registrationCode.findUniqueOrThrow({ where: { id: g2.id } })).groupUsed, 1, "the refused one did not count towards the group");
    const g3 = await mk({ active: false });
    const c3 = await mk({ parentId: g3.id });
    assert.equal(await useSub(c3.id, g3.id), false, "group switched off");
    assert.equal(await used(c3.id), 0, "and the sub-code's own count was rolled back");
    const g4 = await mk({ expiresAt: new Date(Date.now() - 1000) });
    const c4 = await mk({ parentId: g4.id });
    assert.equal(await useSub(c4.id, g4.id), false, "group expired");

    console.log("registration db: 7 groups passed");
  } finally {
    await db.registrationCode.deleteMany({ where: { label: "__test__", parentId: { not: null } } }); // sub-codes first (the parent link restricts deletes)
    await db.registrationCode.deleteMany({ where: { label: "__test__" } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
