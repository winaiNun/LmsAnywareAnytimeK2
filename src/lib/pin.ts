import { createHash, randomBytes } from "node:crypto";

/** Quick sign-in PIN: 6 digits, bound to one phone (TrustedDevice), only for non-staff accounts. */
export const PIN_LENGTH = 6;
export const PIN_MAX_FAILS = 5;

/** Roles that must always use their password (a 6-digit PIN is too weak for back-office power). */
export const pinAllowed = (role: string) => role !== "ADMIN" && role !== "LIBRARIAN";

/** Returns an error message when the PIN is unusable, else null. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "PIN ต้องเป็นตัวเลข 6 หลัก";
  if (/^(\d)\1{5}$/.test(pin)) return "PIN เดาง่ายเกินไป (เลขซ้ำกันทั้งหมด)";
  if ("0123456789012345".includes(pin) || "9876543210987654".includes(pin)) return "PIN เดาง่ายเกินไป (เลขเรียงกัน)";
  return null;
}

/** Random secret kept on the phone; only its SHA-256 is stored (the token itself is 256-bit, so a fast hash is enough). */
export const newDeviceToken = () => randomBytes(32).toString("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Short human label for the device list, from the User-Agent. */
export function deviceLabel(ua: string): string {
  const os = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "Mac" : "อุปกรณ์";
  const br = /EdgA?\//.test(ua) ? "Edge" : /SamsungBrowser/i.test(ua) ? "Samsung Internet" : /(CriOS|Chrome)\//.test(ua) ? "Chrome" : /(FxiOS|Firefox)\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "เบราว์เซอร์";
  return `${os} · ${br}`;
}
