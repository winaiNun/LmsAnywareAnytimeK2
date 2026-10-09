/** Quick sign-in PIN: 6 digits, only for non-staff accounts, locked after repeated mistakes. */
export const PIN_LENGTH = 6;
export const PIN_MAX_FAILS = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;

/** Roles that must always use their password (a 6-digit PIN is too weak for back-office power). */
export const pinAllowed = (role: string) => role !== "ADMIN" && role !== "LIBRARIAN";

/** Returns an error message when the PIN is unusable, else null. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "PIN ต้องเป็นตัวเลข 6 หลัก";
  if (/^(\d)\1{5}$/.test(pin)) return "PIN เดาง่ายเกินไป (เลขซ้ำกันทั้งหมด)";
  if ("0123456789012345".includes(pin) || "9876543210987654".includes(pin)) return "PIN เดาง่ายเกินไป (เลขเรียงกัน)";
  return null;
}
