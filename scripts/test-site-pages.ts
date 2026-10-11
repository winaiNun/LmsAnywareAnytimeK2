import assert from "node:assert/strict";
import { safeHttpsUrl } from "../src/lib/embed";
import { DEFAULT_PAGES, PAGE_SLUGS, parseBody, parseInline, safeHref } from "../src/lib/site-pages";
import { isBot } from "../src/lib/site-stats";

// 1) page markup: paragraphs, headings, lists, links
const blocks = parseBody("บรรทัดแรก\nต่อบรรทัด\n\n## หัวข้อ\n- ข้อหนึ่ง\n- ข้อสอง [ไปคลัง](/library)\n\nย่อหน้าใหม่");
assert.deepEqual(blocks.map((b) => b.type), ["p", "h", "ul", "p"]);
assert.equal((blocks[0] as { inline: { text: string }[] }).inline[0].text, "บรรทัดแรก ต่อบรรทัด");
assert.equal((blocks[2] as { items: unknown[] }).items.length, 2);

// 2) links: only https, site paths, mailto and tel become links; everything else stays plain text
assert.deepEqual(parseInline("[ดู](https://example.com/a?b=1)"), [{ text: "ดู", href: "https://example.com/a?b=1" }]);
for (const bad of ["javascript:alert(1)", "http://example.com", "//evil.com", "data:text/html,x", "https://exa mple.com", "JaVaScRiPt:alert(1)", "vbscript:x"]) {
  assert.equal(safeHref(bad), false, bad);
}
const evil = parseInline("[คลิก](javascript:alert(1))");
assert.equal(evil.some((p) => p.href), false);
assert.ok(safeHref("mailto:a@b.co") && safeHref("tel:+66 44 123 456") && safeHref("/library?area=math"));

// 3) raw HTML is never interpreted: it stays text inside a paragraph (React escapes it when rendered)
const html = parseBody('<script>alert(1)</script>\n<img src=x onerror=alert(1)>');
assert.equal(html.length, 1);
assert.equal(html[0].type, "p");

// 4) every built-in page has a title and a body
for (const s of PAGE_SLUGS) assert.ok(DEFAULT_PAGES[s].title && DEFAULT_PAGES[s].body.length > 40, s);

// 5) outside-source links: https only, no credentials, no private hosts
assert.deepEqual(safeHttpsUrl("https://www.dltv.ac.th"), { url: "https://www.dltv.ac.th/" });
assert.deepEqual(safeHttpsUrl("dltv.ac.th"), { url: "https://dltv.ac.th/" });
for (const bad of ["http://example.com", "javascript:alert(1)", "https://user:pw@example.com", "https://localhost/x", "https://192.168.1.5", "ftp://x.org", ""]) {
  assert.ok("error" in safeHttpsUrl(bad), bad);
}

// 6) bots are not visitors
assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
assert.equal(isBot(""), true);
assert.equal(isBot("curl/8.0"), true);
assert.equal(isBot("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"), false);
assert.equal(isBot("Mozilla/5.0 HeadlessChrome/120"), false);

console.log("site pages: 6 groups passed");
