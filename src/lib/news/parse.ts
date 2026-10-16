/**
 * Reads an RSS 2.0 / Atom / RSS 1.0 (RDF) document into plain entries. Pure: no network, no database.
 * Everything that reaches the page is plain text and a checked link: tags are stripped, entities decoded,
 * links must be http(s), pictures must be https. Anything unreadable is dropped, never guessed.
 */
import { XMLParser } from "fast-xml-parser";

export type NewsEntry = { title: string; link: string; date: string | null; summary: string; image: string | null };
export type ParsedFeed = { title: string; entries: NewsEntry[] };

export const MAX_ENTRY_TITLE = 200;
export const MAX_ENTRY_SUMMARY = 220;
const MAX_ENTRIES_PARSED = 200;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML or text -> one line of plain text, at most `max` characters. */
export function plainText(raw: unknown, max: number): string {
  let s = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
  s = s.replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>/g, " ");
  s = decodeEntities(s).replace(/<[^>]*>/g, " "); // entities can hide a second layer of tags (&lt;b&gt;)
  s = s.replace(/[\u0000-\u001f\u007f​-‍﻿]/g, " ").replace(/\s+/g, " ").trim();
  if (s.length > max) s = `${s.slice(0, max - 1).trimEnd()}…`;
  return s;
}

/** A link we are willing to show: absolute (or resolved against the feed address), http or https, no credentials. */
export function safeLink(raw: unknown, base?: string): string | null {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 2000) return null;
  try {
    const u = new URL(raw.trim(), base);
    if ((u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Pictures are loaded by the visitor's browser straight from the source: https only (no mixed content). */
export function safeImage(raw: unknown, base?: string): string | null {
  const link = safeLink(raw, base);
  return link && link.startsWith("https://") ? link : null;
}

/** RFC 822 ("Thu, 10 Oct 2024 10:00:00 +0700"), ISO 8601, or anything Date understands -> ISO string; otherwise null. */
export function toIso(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const t = Date.parse(raw.trim());
  if (!Number.isFinite(t)) return null;
  const year = new Date(t).getUTCFullYear();
  return year >= 1990 && year <= 2100 ? new Date(t).toISOString() : null;
}

type Node = Record<string, unknown>;
const asArray = <T>(v: T | T[] | undefined | null): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);

/** The text of an element: a plain string, or the "#text" of an element that also has attributes. */
function text(v: unknown): string {
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (isNode(v)) return typeof v["#text"] === "string" || typeof v["#text"] === "number" ? String(v["#text"]) : "";
  return "";
}

const attr = (v: unknown, name: string): string => (isNode(v) && typeof v[`@_${name}`] === "string" ? (v[`@_${name}`] as string) : "");

function firstImgSrc(html: string): string | null {
  const m = /<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(html);
  return m ? decodeEntities(m[1]) : null;
}

function imageOf(item: Node, base: string, html: string): string | null {
  for (const e of asArray(item["enclosure"])) {
    const type = attr(e, "type");
    if (type.startsWith("image/") || (!type && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(attr(e, "url")))) {
      const img = safeImage(attr(e, "url"), base);
      if (img) return img;
    }
  }
  for (const key of ["media:thumbnail", "media:content"]) {
    for (const m of asArray(item[key])) {
      const medium = attr(m, "medium");
      const type = attr(m, "type");
      if (key === "media:content" && medium && medium !== "image" && !type.startsWith("image/")) continue;
      if (key === "media:content" && !medium && type && !type.startsWith("image/")) continue;
      const img = safeImage(attr(m, "url"), base);
      if (img) return img;
    }
  }
  const inline = firstImgSrc(html);
  return inline ? safeImage(inline, base) : null;
}

function linkOf(item: Node, base: string): string | null {
  const l = item["link"];
  // Atom: <link rel="alternate" href="..."/> (may be several); RSS: <link>text</link>
  const links = asArray(l);
  for (const x of links) {
    const rel = attr(x, "rel");
    const href = attr(x, "href");
    if (href && (!rel || rel === "alternate")) {
      const ok = safeLink(href, base);
      if (ok) return ok;
    }
  }
  for (const x of links) {
    const ok = safeLink(text(x).trim(), base);
    if (ok) return ok;
  }
  const guid = item["guid"];
  if (isNode(guid) ? attr(guid, "isPermaLink") !== "false" : typeof guid === "string") return safeLink(text(guid).trim(), base);
  return null;
}

function entryOf(item: Node, base: string): NewsEntry | null {
  const link = linkOf(item, base);
  const title = plainText(text(item["title"]), MAX_ENTRY_TITLE);
  if (!link || !title) return null;
  const html = text(item["content:encoded"]) || text(item["content"]) || text(item["description"]) || text(item["summary"]);
  const summary = plainText(text(item["description"]) || text(item["summary"]) || html, MAX_ENTRY_SUMMARY);
  const date = toIso(text(item["pubDate"])) ?? toIso(text(item["dc:date"])) ?? toIso(text(item["published"])) ?? toIso(text(item["updated"])) ?? toIso(text(item["dcterms:issued"]));
  return { title, link, date, summary: summary === title ? "" : summary, image: imageOf(item, base, html) };
}

/** Parse a feed document. Throws a Thai message when it is not a feed. `base` = the feed's own address (for relative links). */
export function parseFeed(xml: string, base: string): ParsedFeed {
  const source = String(xml ?? "").replace(/^﻿/, "");
  if (/<!ENTITY/i.test(source)) throw new Error("ฟีดนี้มีรูปแบบที่ไม่ปลอดภัย (ENTITY)");
  let doc: Node;
  try {
    doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", parseTagValue: false, parseAttributeValue: false, trimValues: true, processEntities: true, htmlEntities: false }).parse(source) as Node;
  } catch {
    throw new Error("อ่านไฟล์นี้เป็นฟีดไม่ได้ (รูปแบบ XML ไม่ถูกต้อง)");
  }

  let title = "";
  let items: unknown[] = [];
  if (isNode(doc["rss"])) {
    const channel = (doc["rss"] as Node)["channel"];
    const ch = isNode(channel) ? channel : Array.isArray(channel) && isNode(channel[0]) ? (channel[0] as Node) : null;
    if (ch) {
      title = text(ch["title"]);
      items = asArray(ch["item"] as unknown);
    }
  } else if (isNode(doc["feed"])) {
    const feed = doc["feed"] as Node;
    title = text(feed["title"]);
    items = asArray(feed["entry"] as unknown);
  } else if (isNode(doc["rdf:RDF"])) {
    const rdf = doc["rdf:RDF"] as Node;
    title = text(isNode(rdf["channel"]) ? (rdf["channel"] as Node)["title"] : "");
    items = asArray(rdf["item"] as unknown);
  } else {
    throw new Error("ลิงก์นี้ไม่ใช่ฟีด RSS/Atom (ไม่พบโครงสร้างของฟีด)");
  }

  const entries: NewsEntry[] = [];
  for (const it of items.slice(0, MAX_ENTRIES_PARSED)) {
    if (!isNode(it)) continue;
    const e = entryOf(it, base);
    if (e) entries.push(e);
  }
  return { title: plainText(title, 120), entries };
}
