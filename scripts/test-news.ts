import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { fetchFeed, FEED_MAX_BYTES } from "../src/lib/news/fetch";
import { checkFeedUrl, isPrivateIp } from "../src/lib/news/host-guard";
import { clampPageSize, linkKey, mergeCards, paginate, type NewsCard } from "../src/lib/news/merge";
import { PAIRS, TONES, pairFor, tabColors, toneFor, type Tone } from "../src/lib/news/palette";
import { MAX_ENTRY_TITLE, parseFeed, plainText, safeImage, safeLink, toIso } from "../src/lib/news/parse";
import { parseItemInput, parseTabInput } from "../src/lib/news/validate";

let failed = 0;
const t = async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    console.log("ok", name);
  } catch (e) {
    failed++;
    console.error("FAIL", name, e);
  }
};

const BASE = "https://news.example.go.th/feed/rss";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>ข่าว สพป.</title>
<item><title><![CDATA[ประกาศ &amp; <b>รับสมัคร</b>]]></title><link>https://news.example.go.th/a/1</link><pubDate>Thu, 10 Oct 2024 10:00:00 +0700</pubDate>
  <description><![CDATA[<p>รายละเอียด <b>ข่าว</b> &nbsp;สั้นๆ</p><img src="https://img.example.com/x.jpg">]]></description><enclosure url="https://img.example.com/cover.png" type="image/png" length="1"/></item>
<item><title>ลิงก์สัมพัทธ์</title><link>/a/2</link><dc:date>2024-10-12T08:00:00+07:00</dc:date><media:thumbnail url="http://img.example.com/insecure.jpg"/></item>
<item><title>อันตราย</title><link>javascript:alert(1)</link></item>
<item><title>วันที่เสีย</title><link>https://news.example.go.th/a/3</link><pubDate>เมื่อวาน</pubDate><description>x</description></item>
<item><title>   </title><link>https://news.example.go.th/a/4</link></item>
<item><title>ในเนื้อหา</title><link>https://news.example.go.th/a/5</link><content:encoded><![CDATA[<div><img src="https://img.example.com/inline.webp" alt=""><p>ข้อความ</p></div>]]></content:encoded></item>
<item><title>แท็กซ้อน</title><link>https://news.example.go.th/a/6</link><description>&lt;script&gt;alert(1)&lt;/script&gt;ปกติ</description></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title type="text">Atom ข่าว</title>
<entry><title type="html">หัวข้อ Atom</title><link rel="self" href="https://a.example.org/self"/><link rel="alternate" href="https://a.example.org/post/1"/><updated>2024-09-01T00:00:00Z</updated><summary>สรุป</summary></entry>
<entry><title>ไม่มีลิงก์</title></entry></feed>`;

const RDF = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>RDF</title></channel>
<item><title>รายการ RDF</title><link>https://r.example.org/1</link><dc:date>2024-01-02</dc:date></item></rdf:RDF>`;

async function main() {
  await t("plain text: tags and entities are removed, length is capped", () => {
    assert.equal(plainText("<p>ก&amp;ข &nbsp;<b>ค</b></p>", 50), "ก&ข ค");
    assert.equal(plainText("&lt;script&gt;alert(1)&lt;/script&gt;ดี", 50), "alert(1) ดี");
    assert.equal(plainText("<script>bad()</script>ดี<style>p{}</style>", 50), "ดี");
    assert.equal(plainText("a".repeat(300), 20).length, 20);
    assert.ok(plainText("a".repeat(300), 20).endsWith("…"));
    assert.equal(plainText(undefined, 10), "");
    assert.equal(plainText("&#3585;&#x0e02;", 10), "กข");
  });

  await t("links: only http(s), resolved against the feed, no credentials; pictures only https", () => {
    assert.equal(safeLink("/a/2", BASE), "https://news.example.go.th/a/2");
    assert.equal(safeLink("http://x.org/p", BASE), "http://x.org/p");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.org/f", "https://user:pw@x.org/", "", "  ", "mailto:a@b.c"]) assert.equal(safeLink(bad, BASE), null, bad);
    assert.equal(safeImage("http://x.org/i.jpg", BASE), null);
    assert.equal(safeImage("//img.example.com/i.jpg", BASE), "https://img.example.com/i.jpg");
  });

  await t("dates: RFC 822, ISO, garbage", () => {
    assert.equal(toIso("Thu, 10 Oct 2024 10:00:00 +0700"), "2024-10-10T03:00:00.000Z");
    assert.equal(toIso("2024-10-12T08:00:00+07:00"), "2024-10-12T01:00:00.000Z");
    assert.equal(toIso("เมื่อวาน"), null);
    assert.equal(toIso(""), null);
    assert.equal(toIso("1850-01-01"), null);
  });

  await t("RSS 2.0: titles, links, dates, summaries, pictures; unsafe or empty entries are dropped", () => {
    const f = parseFeed(RSS, BASE);
    assert.equal(f.title, "ข่าว สพป.");
    assert.deepEqual(f.entries.map((e) => e.link), ["https://news.example.go.th/a/1", "https://news.example.go.th/a/2", "https://news.example.go.th/a/3", "https://news.example.go.th/a/5", "https://news.example.go.th/a/6"]);
    const [a, b, c, d, e] = f.entries;
    assert.equal(a.title, "ประกาศ & รับสมัคร");
    assert.equal(a.date, "2024-10-10T03:00:00.000Z");
    assert.equal(a.summary, "รายละเอียด ข่าว สั้นๆ");
    assert.equal(a.image, "https://img.example.com/cover.png", "enclosure wins over the inline picture");
    assert.equal(b.date, "2024-10-12T01:00:00.000Z");
    assert.equal(b.image, null, "http picture dropped");
    assert.equal(c.date, null);
    assert.equal(d.image, "https://img.example.com/inline.webp", "first <img> of the content");
    assert.ok(!e.summary.includes("<"), "no markup survives");
  });

  await t("Atom and RSS 1.0 (RDF)", () => {
    const a = parseFeed(ATOM, "https://a.example.org/feed");
    assert.equal(a.title, "Atom ข่าว");
    assert.deepEqual(a.entries.map((x) => [x.title, x.link, x.date]), [["หัวข้อ Atom", "https://a.example.org/post/1", "2024-09-01T00:00:00.000Z"]]);
    const r = parseFeed(RDF, "https://r.example.org/");
    assert.deepEqual(r.entries.map((x) => [x.title, x.link]), [["รายการ RDF", "https://r.example.org/1"]]);
  });

  await t("not a feed, broken XML, entity tricks", () => {
    assert.throws(() => parseFeed("<html><body>hi</body></html>", BASE), /ไม่ใช่ฟีด/);
    assert.throws(() => parseFeed("", BASE), /ไม่ใช่ฟีด|อ่าน/);
    assert.throws(() => parseFeed(`<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><rss><channel><title>&a;</title></channel></rss>`, BASE), /ไม่ปลอดภัย/);
    assert.equal(parseFeed(`<rss><channel><title>ว่าง</title></channel></rss>`, BASE).entries.length, 0);
  });

  await t("a very long title is cut, a feed of thousands of entries is bounded", () => {
    const long = parseFeed(`<rss><channel><title>t</title><item><title>${"ก".repeat(900)}</title><link>https://x.org/1</link></item></channel></rss>`, BASE);
    assert.ok(long.entries[0].title.length <= MAX_ENTRY_TITLE);
    const many = parseFeed(`<rss><channel><title>t</title>${Array.from({ length: 1000 }, (_, i) => `<item><title>n${i}</title><link>https://x.org/${i}</link></item>`).join("")}</channel></rss>`, BASE);
    assert.ok(many.entries.length <= 200);
  });

  await t("host guard: addresses we refuse", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:10.0.0.1", "::ffff:127.0.0.1", "2001:db8::1", "64:ff9b::1", "2002:0a00:0001::1"]) assert.equal(isPrivateIp(ip), true, ip);
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "203.150.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) assert.equal(isPrivateIp(ip), false, ip);
    assert.equal(isPrivateIp("not-an-ip"), true);
  });

  await t("host guard: addresses typed by an admin", () => {
    assert.deepEqual(checkFeedUrl("example.go.th/rss"), { ok: true, url: "https://example.go.th/rss" });
    assert.deepEqual(checkFeedUrl("http://example.go.th/rss#top"), { ok: true, url: "http://example.go.th/rss" });
    for (const bad of ["", "   ", "file:///etc/passwd", "ftp://x.org/f", "javascript:alert(1)", "https://user:pw@x.org/f", "http://localhost/f", "http://foo.localhost/f", "http://printer.local/f", "http://db.internal/f", "http://127.0.0.1/f", "http://[::1]/f", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5/f", "https://x.org:8443/f", "http://intranet/f", "https://" + "a".repeat(600) + ".org"]) {
      assert.equal(checkFeedUrl(bad).ok, false, bad);
    }
    assert.equal(checkFeedUrl("http://127.0.0.1:8080/f", { allowPrivate: true }).ok, true, "tests may use a local server");
  });

  await t("merge: manual wins a duplicate, pinned first, newest first, no date last, stable", () => {
    const c = (key: string, link: string, date: string | null, over: Partial<NewsCard> = {}): NewsCard => ({ key, title: key, link, date, note: "", image: null, source: "", kind: "LINK", pinned: false, ...over });
    const manual = [c("m-old", "https://a.org/1", "2024-01-01T00:00:00Z"), c("m-pin", "https://a.org/2", "2023-01-01T00:00:00Z", { pinned: true }), c("m-pin2", "https://a.org/3", "2023-06-01T00:00:00Z", { pinned: true })];
    const feeds = [c("f-dup", "https://A.org/1/?utm_source=x#frag", "2025-01-01T00:00:00Z", { kind: "FEED" }), c("f-new", "https://a.org/new", "2025-02-01T00:00:00Z", { kind: "FEED" }), c("f-nodate", "https://a.org/nd", null, { kind: "FEED" }), c("f-same", "https://a.org/same", "2024-01-01T00:00:00Z", { kind: "FEED" })];
    assert.deepEqual(mergeCards(manual, feeds).map((x) => x.key), ["m-pin2", "m-pin", "f-new", "m-old", "f-same", "f-nodate"]);
    assert.equal(linkKey("https://A.org/x/?utm_medium=y&id=2#z"), "https://a.org/x?id=2");
    assert.deepEqual(mergeCards([], []), []);
  });

  await t("pagination: ranges, clamping, size limits", () => {
    const list = Array.from({ length: 25 }, (_, i) => i);
    assert.deepEqual(paginate(list, 1, 10), { items: list.slice(0, 10), page: 1, pages: 3, total: 25 });
    assert.deepEqual(paginate(list, 3, 10).items, [20, 21, 22, 23, 24]);
    assert.equal(paginate(list, 99, 10).page, 3);
    assert.equal(paginate(list, 0, 10).page, 1);
    assert.equal(paginate(list, -4, 10).page, 1);
    assert.equal(paginate(list, "abc", 10).page, 1);
    assert.equal(paginate(list, "2", 10).page, 2);
    assert.deepEqual(paginate([], 1, 10), { items: [], page: 1, pages: 1, total: 0 });
    assert.equal(paginate(list, 1, 1).items.length, 3, "size is raised to the minimum of 3");
    assert.equal(paginate(list, 1, 999).items.length, 25);
    assert.equal(clampPageSize(2), 3);
    assert.equal(clampPageSize(31), 30);
    assert.equal(clampPageSize("x"), 8);
  });

  await t("tab form: name and page size limits", () => {
    assert.deepEqual(parseTabInput({ name: "  ข่าว  ", pageSize: "8" }), { ok: true, data: { name: "ข่าว", pageSize: 8 } });
    for (const bad of [{ name: "", pageSize: "8" }, { name: "x".repeat(61), pageSize: "8" }, { name: "ข่าว", pageSize: "2" }, { name: "ข่าว", pageSize: "31" }, { name: "ข่าว", pageSize: "abc" }, { name: "ข่าว", pageSize: "" }, { name: "ข่าว", pageSize: "7.5" }]) {
      assert.equal(parseTabInput(bad).ok, false, JSON.stringify(bad));
    }
    assert.equal(parseTabInput({ name: "ข่าว", pageSize: "3" }).ok, true);
    assert.equal(parseTabInput({ name: "ข่าว", pageSize: "30" }).ok, true);
  });

  await t("item form: typed links", () => {
    const flags = { pinned: true, active: true };
    const ok = parseItemInput("LINK", { tabId: "t1", title: " ประกาศ ", url: "example.go.th/a?x=1", note: "", publishedAt: "2026-10-01T00:00:00.000Z" }, flags);
    assert.ok(ok.ok && ok.data.title === "ประกาศ" && ok.data.url === "https://example.go.th/a?x=1" && ok.data.note === null && ok.data.pinned === true && ok.data.publishedAt?.toISOString() === "2026-10-01T00:00:00.000Z");
    assert.ok(parseItemInput("LINK", { tabId: "t1", title: "x", url: "http://old.go.th/p" }, flags).ok, "plain http is allowed for a typed link");
    for (const bad of [{ title: "x", url: "javascript:alert(1)" }, { title: "x", url: "data:text/html,hi" }, { title: "x", url: "https://u:p@x.org/" }, { title: "", url: "https://x.org" }, { title: "x", url: "" }, { title: "x".repeat(201), url: "https://x.org" }, { title: "x", url: "https://x.org", note: "n".repeat(161) }, { title: "x", url: "https://x.org", publishedAt: "not a date" }]) {
      assert.equal(parseItemInput("LINK", { tabId: "t1", ...bad }, flags).ok, false, JSON.stringify(bad));
    }
    assert.equal(parseItemInput("LINK", { title: "x", url: "https://x.org" }, flags).ok, false, "a tab must be chosen");
  });

  await t("item form: feeds need a safe address and sane limits", () => {
    const flags = { pinned: true, active: false };
    const ok = parseItemInput("FEED", { tabId: "t1", title: "สพฐ.", url: "obec.go.th/rss", feedLimit: "20", feedCacheMin: "60" }, flags);
    assert.ok(ok.ok && ok.data.url === "https://obec.go.th/rss" && ok.data.feedLimit === 20 && ok.data.feedCacheMin === 60 && ok.data.pinned === false && ok.data.active === false, "a feed is never pinned");
    for (const bad of [{ url: "http://127.0.0.1/rss" }, { url: "http://169.254.169.254/" }, { url: "file:///etc/passwd" }, { url: "http://localhost/rss" }, { feedLimit: "4" }, { feedLimit: "51" }, { feedCacheMin: "14" }, { feedCacheMin: "361" }, { title: "" }]) {
      assert.equal(parseItemInput("FEED", { tabId: "t1", title: "x", url: "https://x.org/rss", feedLimit: "20", feedCacheMin: "60", ...bad }, flags).ok, false, JSON.stringify(bad));
    }
  });

  await t("palette: every colour is readable, tabs and cards alternate in neighbouring hues", () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const [name, tone] of Object.entries(TONES) as [string, Tone][]) {
      assert.ok(contrast("#FFFFFF", tone.solid) >= 4.5, `${name}: white on solid ${contrast("#FFFFFF", tone.solid).toFixed(2)}`);
      assert.ok(contrast(tone.solid, tone.soft) >= 4.5, `${name}: solid on soft ${contrast(tone.solid, tone.soft).toFixed(2)}`);
    }
    // a card alternates between the two hues of its tab; the next tab uses another pair; it wraps round
    assert.deepEqual([0, 1, 2, 3].map((i) => toneFor(0, i).solid), [TONES.blue.solid, TONES.violet.solid, TONES.blue.solid, TONES.violet.solid]);
    assert.equal(toneFor(1, 0).solid, TONES.teal.solid);
    assert.equal(toneFor(2, 1).solid, TONES.rose.solid);
    assert.equal(toneFor(PAIRS.length, 0).solid, TONES.blue.solid, "tabs wrap round");
    assert.equal(toneFor(0, 7).solid, TONES.violet.solid, "page 2 continues the rhythm (the index is global)");
    assert.deepEqual(tabColors(0), [TONES.blue.solid, TONES.violet.solid]);
    assert.notEqual(pairFor(0)[0].solid, pairFor(1)[0].solid);
    assert.doesNotThrow(() => toneFor(-1, -3));
  });

  // ---- the network part, against a feed server of our own
  process.env.NEWS_ALLOW_PRIVATE_HOSTS = "1";
  let hits = 0;
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    hits++;
    const path = req.url ?? "/";
    if (path === "/rss") return void res.writeHead(200, { "Content-Type": "application/rss+xml; charset=utf-8" }).end(RSS);
    if (path === "/html") return void res.writeHead(200, { "Content-Type": "text/html" }).end("<html>no</html>");
    if (path === "/missing") return void res.writeHead(404).end("no");
    if (path === "/big") return void res.writeHead(200, { "Content-Type": "application/xml" }).end("<rss><channel><title>t</title>" + "x".repeat(FEED_MAX_BYTES + 10) + "</channel></rss>");
    if (path === "/redirect") return void res.writeHead(302, { Location: "/rss" }).end();
    if (path === "/loop") return void res.writeHead(302, { Location: "/loop" }).end();
    if (path === "/thai") {
      // windows-874 ("ข่าว" = A2 E8 D2 C7)
      const head = Buffer.from('<rss><channel><title>', "latin1");
      const mid = Buffer.from([0xa2, 0xe8, 0xd2, 0xc7]);
      const tail = Buffer.from("</title><item><title>ok</title><link>https://x.org/1</link></item></channel></rss>", "latin1");
      return void res.writeHead(200, { "Content-Type": "text/xml; charset=windows-874" }).end(Buffer.concat([head, mid, tail]));
    }
    if (path === "/slow") return; // never answers
    res.writeHead(500).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  await t("fetch: a good feed, a redirect, a Thai charset", async () => {
    const ok = await fetchFeed(`${base}/rss`);
    assert.ok(ok.ok && ok.feed.entries.length === 5);
    const red = await fetchFeed(`${base}/redirect`);
    assert.ok(red.ok && red.feed.entries.length === 5, "one redirect is followed");
    const thai = await fetchFeed(`${base}/thai`);
    assert.ok(thai.ok && thai.feed.title === "ข่าว", thai.ok ? thai.feed.title : "");
  });

  await t("fetch: problems come back as Thai messages, never as exceptions", async () => {
    const html = await fetchFeed(`${base}/html`);
    assert.ok(!html.ok && html.error.includes("ไม่ใช่ฟีด"));
    const missing = await fetchFeed(`${base}/missing`);
    assert.ok(!missing.ok && missing.error.includes("404"));
    const big = await fetchFeed(`${base}/big`);
    assert.ok(!big.ok && big.error.includes("ใหญ่เกินไป"));
    const loop = await fetchFeed(`${base}/loop`);
    assert.ok(!loop.ok && loop.error.includes("ส่งต่อลิงก์"));
    const bad = await fetchFeed("javascript:alert(1)");
    assert.ok(!bad.ok);
    const down = await fetchFeed("http://127.0.0.1:9/never");
    assert.ok(!down.ok);
  });

  await t("fetch: a server that never answers times out", async () => {
    const started = Date.now();
    const slow = await fetchFeed(`${base}/slow`);
    assert.ok(!slow.ok && slow.error.includes("ช้า"));
    assert.ok(Date.now() - started < 9000, "gives up after about 6 seconds");
  });

  await t("fetch: with the test switch off, our own machine is refused", async () => {
    delete process.env.NEWS_ALLOW_PRIVATE_HOSTS;
    const before = hits;
    const r = await fetchFeed(`${base}/rss`);
    assert.ok(!r.ok);
    assert.equal(hits, before, "no request reached the server");
    process.env.NEWS_ALLOW_PRIVATE_HOSTS = "1";
  });

  server.closeAllConnections?.();
  server.close();
  if (failed) {
    console.error(`${failed} news test(s) failed`);
    process.exit(1);
  }
  console.log("news: all groups passed");
}

main();
