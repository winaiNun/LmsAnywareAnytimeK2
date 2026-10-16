/**
 * Guards for fetching an outside RSS/Atom address from our server (SSRF). Only managers can enter a feed address,
 * but the server still refuses anything that points inside our own network. Pure parts (`checkFeedUrl`, `isPrivateIp`)
 * are testable without a network; `assertPublicHost` does the DNS lookup.
 *
 * Test hook: outside production, NEWS_ALLOW_PRIVATE_HOSTS=1 lets the tests use a feed server on 127.0.0.1.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const allowPrivateForTests = () => process.env.NODE_ENV !== "production" && process.env.NEWS_ALLOW_PRIVATE_HOSTS === "1";

const MAX_URL = 500;

/** "https://example.com/feed" -> normalised URL, or a Thai error. A bare host gets https://. http and https only, standard ports, no credentials. */
export function checkFeedUrl(raw: string, opts: { allowPrivate?: boolean } = {}): { ok: true; url: string } | { ok: false; error: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { ok: false, error: "กรุณากรอกลิงก์" };
  if (text.length > MAX_URL) return { ok: false, error: `ลิงก์ยาวเกิน ${MAX_URL} ตัวอักษร` };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, error: "ลิงก์ไม่ถูกต้อง" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://" };
  if (u.username || u.password) return { ok: false, error: "ลิงก์ห้ามมีชื่อผู้ใช้/รหัสผ่านฝังอยู่" };
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!opts.allowPrivate) {
    if (u.port && u.port !== "80" && u.port !== "443") return { ok: false, error: "ใช้ได้เฉพาะพอร์ตมาตรฐาน (80/443)" };
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return { ok: false, error: "ลิงก์นี้ชี้ไปยังที่อยู่ภายใน ไม่อนุญาต" };
    const ip = isIP(host);
    if (ip && isPrivateIp(host)) return { ok: false, error: "ลิงก์นี้ชี้ไปยังที่อยู่ภายใน ไม่อนุญาต" };
    if (!ip && !host.includes(".")) return { ok: false, error: "ลิงก์ไม่ถูกต้อง (ไม่มีชื่อโดเมน)" };
  }
  u.hash = "";
  return { ok: true, url: u.toString() };
}

const v4 = (ip: string) => ip.split(".").map(Number);

function privateV4(ip: string): boolean {
  const [a, b, c] = v4(ip);
  if (a === 0 || a === 10 || a === 127) return true; // this network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 169 && b === 254) return true; // link-local (cloud metadata lives here)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/** The 16 bytes of an IPv6 address (handles "::" and a trailing dotted IPv4). */
function v6bytes(ip: string): number[] | null {
  let text = ip.toLowerCase().split("%")[0];
  const tail = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail) {
    const [a, b, c, d] = v4(tail[2]);
    text = `${tail[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...rest];
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16);
    out.push(n >> 8, n & 255);
  }
  return out.length === 16 ? out : null;
}

/** True for loopback, private, link-local, multicast, reserved and "embedded IPv4" addresses that point inside. Unparseable = treated as private. */
export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return privateV4(ip);
  if (kind !== 6) return true;
  const b = v6bytes(ip);
  if (!b) return true;
  const allZero = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);
  if (allZero(0, 15) && (b[15] === 0 || b[15] === 1)) return true; // :: and ::1
  if (allZero(0, 10) && b[10] === 255 && b[11] === 255) return privateV4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`); // ::ffff:a.b.c.d
  if (allZero(0, 12)) return true; // IPv4-compatible (::a.b.c.d)
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return true; // NAT64
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return true; // fec0::/10 site-local
  if (b[0] === 0xff) return true; // multicast
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true; // documentation
  if (b[0] === 0x20 && b[1] === 0x02) return privateV4(`${b[2]}.${b[3]}.${b[4]}.${b[5]}`); // 6to4 embeds an IPv4
  return false;
}

/** Resolve the host and refuse when ANY address it points to is internal. Throws a Thai message. */
export async function assertPublicHost(hostname: string, opts: { allowPrivate?: boolean } = {}): Promise<void> {
  if (opts.allowPrivate) return;
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("ลิงก์นี้ชี้ไปยังที่อยู่ภายใน ไม่อนุญาต");
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new Error("หาเว็บนี้ไม่พบ (ตรวจสอบชื่อโดเมน)");
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("ลิงก์นี้ชี้ไปยังที่อยู่ภายใน ไม่อนุญาต");
}
