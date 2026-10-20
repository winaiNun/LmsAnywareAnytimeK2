import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";

// No 0/O, 1/I/L: codes are read aloud and copied from printed sheets.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

/** A random sign-up code (8 chars, ~39 bits) from a CSPRNG. */
export function generateCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** What people type: any case, with spaces or dashes. */
export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** For display and copying: ABCD-EFGH */
export const formatCode = (code: string) => (code.length === CODE_LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

export type CodeStatus = "ok" | "inactive" | "expired" | "used-up";

type CodeLike = { active: boolean; expiresAt: Date | null; maxUses: number | null; usedCount: number; groupUsed?: number };

/**
 * What a code's limit is compared with. A top-level code (a group code, or an ordinary code without sub-codes) limits the sign-ups
 * through itself AND its sub-codes (`groupUsed`); a sub-code limits only its own sign-ups.
 */
export const usedTowardsLimit = (c: CodeLike, isSub: boolean) => (isSub ? c.usedCount : c.groupUsed ?? c.usedCount);

/**
 * Pure: is this code usable right now? (the atomic redeem below enforces the same rules in SQL.)
 * A sub-code is also stopped by its group code: switching the group off, its expiry and its total limit all apply to every sub-code.
 */
export function codeStatus(c: CodeLike, now = new Date(), parent?: CodeLike | null): CodeStatus {
  const own = (x: CodeLike, isSub: boolean): CodeStatus => {
    if (!x.active) return "inactive";
    if (x.expiresAt && x.expiresAt <= now) return "expired";
    if (x.maxUses !== null && usedTowardsLimit(x, isSub) >= x.maxUses) return "used-up";
    return "ok";
  };
  const mine = own(c, !!parent);
  if (mine !== "ok" || !parent) return mine;
  return own(parent, false);
}

export const STATUS_LABEL: Record<CodeStatus, string> = { ok: "ใช้งานได้", inactive: "ปิดใช้งาน", expired: "หมดอายุ", "used-up": "ใช้ครบแล้ว" };

/**
 * Use up one seat of a code inside the caller's transaction. One UPDATE with the conditions in its WHERE:
 * when two people redeem the last seat at the same moment, the database lets exactly one of them through.
 * Expiry is compared with the database clock (an absolute instant, so Bangkok time is not a factor).
 */
export async function redeemCode(tx: Prisma.TransactionClient, id: string, parentId?: string | null): Promise<boolean> {
  if (!parentId) {
    // top-level code: its own count and the group total move together; the limit is the group total
    const n = await tx.$executeRaw`
      UPDATE "RegistrationCode" SET "usedCount" = "usedCount" + 1, "groupUsed" = "groupUsed" + 1
      WHERE "id" = ${id} AND "active" = true
        AND ("expiresAt" IS NULL OR "expiresAt" > now())
        AND ("maxUses" IS NULL OR "groupUsed" < "maxUses")`;
    return n === 1;
  }
  // sub-code: its own limit AND the group code's (active, expiry, total) must all allow it; the caller rolls back when this is false
  const own = await tx.$executeRaw`
    UPDATE "RegistrationCode" SET "usedCount" = "usedCount" + 1
    WHERE "id" = ${id} AND "active" = true
      AND ("expiresAt" IS NULL OR "expiresAt" > now())
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
  if (own !== 1) return false;
  const group = await tx.$executeRaw`
    UPDATE "RegistrationCode" SET "groupUsed" = "groupUsed" + 1
    WHERE "id" = ${parentId} AND "active" = true
      AND ("expiresAt" IS NULL OR "expiresAt" > now())
      AND ("maxUses" IS NULL OR "groupUsed" < "maxUses")`;
  return group === 1;
}
