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

/** Pure: is this code usable right now? (the atomic redeem below enforces the same rules in SQL) */
export function codeStatus(c: { active: boolean; expiresAt: Date | null; maxUses: number | null; usedCount: number }, now = new Date()): CodeStatus {
  if (!c.active) return "inactive";
  if (c.expiresAt && c.expiresAt <= now) return "expired";
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return "used-up";
  return "ok";
}

export const STATUS_LABEL: Record<CodeStatus, string> = { ok: "ใช้งานได้", inactive: "ปิดใช้งาน", expired: "หมดอายุ", "used-up": "ใช้ครบแล้ว" };

/**
 * Use up one seat of a code inside the caller's transaction. One UPDATE with the conditions in its WHERE:
 * when two people redeem the last seat at the same moment, the database lets exactly one of them through.
 * Expiry is compared with the database clock (an absolute instant, so Bangkok time is not a factor).
 */
export async function redeemCode(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
  const n = await tx.$executeRaw`
    UPDATE "RegistrationCode" SET "usedCount" = "usedCount" + 1
    WHERE "id" = ${id} AND "active" = true
      AND ("expiresAt" IS NULL OR "expiresAt" > now())
      AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
  return n === 1;
}
