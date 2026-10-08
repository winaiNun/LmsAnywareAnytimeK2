import { randomInt } from "node:crypto";

// No 0/O, 1/l/I: temporary passwords get read aloud and typed from printed sheets.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** A random temporary password (default 10 characters ≈ 57 bits). Generated with a CSPRNG. */
export function generateTempPassword(length = 10): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
