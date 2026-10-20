import assert from "node:assert/strict";
import { safeHttpsUrl } from "../src/lib/embed";
import { MAX_PAGE_HTML_BYTES, checkRichBody, driveDirective, imgDirective } from "../src/lib/page-markup";
import { DEFAULT_PAGES, PAGE_SLUGS, parseBody, parseInline, safeHref } from "../src/lib/site-pages";
import { isBot } from "../src/lib/site-stats";
import { DEFAULT_TEXTS, MAX_LINES, TEXT_DEFS, allowsBreaks, lineParts, plainText, resolveTexts } from "../src/lib/site-texts";

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

// 7) editable menu names / headings: defaults, overrides, blanks, junk and over-long values
assert.deepEqual(resolveTexts(undefined), DEFAULT_TEXTS);
assert.deepEqual(resolveTexts(null), DEFAULT_TEXTS);
assert.deepEqual(resolveTexts([1, 2]), DEFAULT_TEXTS);
assert.equal(resolveTexts({ "nav.library": "  คลังความรู้  " })["nav.library"], "คลังความรู้");
assert.equal(resolveTexts({ "nav.library": "   " })["nav.library"], DEFAULT_TEXTS["nav.library"]);
assert.equal(resolveTexts({ "nav.library": 5 })["nav.library"], DEFAULT_TEXTS["nav.library"]);
assert.equal(resolveTexts({ "tab.library": "ก".repeat(50) })["tab.library"].length, 10);
assert.equal(resolveTexts({ "no.such.key": "x" })["no.such.key"], undefined);
for (const d of TEXT_DEFS) assert.ok(d.def.length > 0 && d.def.length <= d.max, d.key);
assert.equal(new Set(TEXT_DEFS.map((d) => d.key)).size, TEXT_DEFS.length);

// 8) admin line breaks with "|": parts are trimmed, empty parts dropped, plain text joins with one space
assert.deepEqual(lineParts("เทคโนโลยีและการบริหาร | สำหรับครู"), ["เทคโนโลยีและการบริหาร", "สำหรับครู"]);
assert.deepEqual(lineParts("  ก||  ข |"), ["ก", "ข"]);
assert.deepEqual(lineParts("ไม่มีเครื่องหมาย"), ["ไม่มีเครื่องหมาย"]);
assert.equal(plainText("ก | ข|ค"), "ก ข ค");
assert.equal(plainText("|"), "");
assert.ok(allowsBreaks("schools.title") && allowsBreaks("library.subtitle") && !allowsBreaks("nav.library") && !allowsBreaks("tab.home"));
assert.equal(MAX_LINES, 4);

console.log("site pages: 8 groups passed");

// 7) rich blocks: picture, Drive file, sandboxed HTML (admin pages only), safe against forged keys
{
  const key = "content/0b9f4c1e-8a3d-4f2e-9d11-aaaaaaaaaaaa.webp";
  const body = `ข้อความ\n\n${imgDirective(key, "แผนผัง | A4")}\n\n${driveDirective("1AbCdEfGhIjKlMnOp", key, "คู่มือ PDF")}\n\n{{html}}\n<b>hi</b>\n<script>1</script>\n{{/html}}\n\nท้าย`;
  const withHtml = parseBody(body, { allowHtml: true });
  assert.deepEqual(withHtml.map((b) => b.type), ["p", "img", "drive", "html", "p"]);
  assert.equal((withHtml[1] as { alt: string }).alt, "แผนผัง A4"); // "|" and braces never survive into the directive
  assert.equal((withHtml[2] as { thumbKey: string | null }).thumbKey, key);
  assert.equal((withHtml[3] as { code: string }).code, "<b>hi</b>\n<script>1</script>");
  // lessons and every non-admin place: the HTML block is dropped, not shown as text
  assert.deepEqual(parseBody(body).map((b) => b.type), ["p", "img", "drive", "p"]);
  // forged keys / ids are plain text, never an <img> pointing somewhere else
  for (const evil of ["{{img ../../etc/passwd | x}}", "{{img https://evil.example/a.webp | x}}", "{{img content/a.webp | x}}", "{{drive x | | y}}", "{{drive javascript:alert(1) | | y}}"]) {
    assert.deepEqual(parseBody(evil).map((b) => b.type), ["p"], evil);
  }
  assert.equal((parseBody(`{{drive 1AbCdEfGhIjKlMnOp | https://evil.example/a.webp | t}}`)[0] as { thumbKey: string | null }).thumbKey, null); // a thumbnail that is not our own key is dropped
  assert.equal((parseBody(`{{drive 1AbCdEfGhIjKlMnOp | | ชื่อ}}`)[0] as { thumbKey: string | null }).thumbKey, null);
  // save-time checks
  assert.equal(checkRichBody(body, { allowHtml: true }), null);
  assert.match(checkRichBody(body, { allowHtml: false }) ?? "", /HTML/);
  assert.match(checkRichBody("{{html}}\nx", { allowHtml: true }) ?? "", /\{\{\/html\}\}/);
  assert.match(checkRichBody(Array(4).fill("{{html}}\nx\n{{/html}}").join("\n"), { allowHtml: true }) ?? "", /ไม่เกิน 3/);
  assert.match(checkRichBody(`{{html}}\n${"a".repeat(MAX_PAGE_HTML_BYTES + 1)}\n{{/html}}`, { allowHtml: true }) ?? "", /ใหญ่เกิน/);
  // old pages are unchanged: the built-in default pages still parse to text blocks only
  for (const slug of PAGE_SLUGS) assert.ok(parseBody(DEFAULT_PAGES[slug].body, { allowHtml: true }).every((b) => ["p", "h", "ul"].includes(b.type)), slug);
}
console.log("rich blocks: ok");
