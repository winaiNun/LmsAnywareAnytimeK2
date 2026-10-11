/* Run with: npm run test:embed (also part of npm test) */
import assert from "node:assert/strict";
import { isFrameable, isParsed, parseMediaLink, type ParsedLink } from "../src/lib/embed";

let passed = 0;
const t = (name: string, fn: () => void) => { try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${(e as Error).message}`); process.exitCode = 1; } };
const ok = (raw: string): ParsedLink => {
  const r = parseMediaLink(raw);
  assert.ok(isParsed(r), `expected ${raw} to parse, got ${JSON.stringify(r)}`);
  return r as ParsedLink;
};
const bad = (raw: string, re?: RegExp) => {
  const r = parseMediaLink(raw);
  assert.ok(!isParsed(r), `expected ${raw} to be rejected, got ${JSON.stringify(r)}`);
  if (re) assert.match((r as { error: string }).error, re);
};

const ID = "dQw4w9WgXcQ";
t("YouTube: every common shape", () => {
  for (const u of [`https://www.youtube.com/watch?v=${ID}`, `https://youtu.be/${ID}`, `https://m.youtube.com/watch?v=${ID}&feature=share`, `https://www.youtube.com/shorts/${ID}`, `https://www.youtube.com/embed/${ID}`, `https://www.youtube.com/live/${ID}`, `youtube.com/watch?v=${ID}`]) {
    const r = ok(u);
    assert.equal(r.kind, "YOUTUBE", u);
    assert.equal(r.embedUrl?.startsWith(`https://www.youtube-nocookie.com/embed/${ID}`), true, u);
    assert.equal(r.openUrl, `https://www.youtube.com/watch?v=${ID}`);
  }
});
t("YouTube: start time and playlists", () => {
  assert.match(ok(`https://youtu.be/${ID}?t=90`).embedUrl!, /start=90/);
  assert.match(ok(`https://www.youtube.com/watch?v=${ID}&t=1m30s`).embedUrl!, /start=90/);
  const pl = ok("https://www.youtube.com/playlist?list=PLabcdefghijklmnop");
  assert.match(pl.embedUrl!, /videoseries\?list=PLabcdefghijklmnop/);
  bad("https://www.youtube.com/watch?v=short", /YouTube/);
  bad("https://www.youtube.com/", /YouTube/);
});
t("Drive: file links, folders refused", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  const r = ok(`https://drive.google.com/file/d/${id}/view?usp=sharing`);
  assert.equal(r.kind, "DRIVE_FILE");
  assert.equal(r.embedUrl, `https://drive.google.com/file/d/${id}/preview`);
  assert.equal(r.downloadUrl, `https://drive.google.com/uc?export=download&id=${id}`);
  assert.equal(ok(`https://drive.google.com/open?id=${id}`).kind, "DRIVE_FILE");
  bad("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345", /โฟลเดอร์/);
});
t("Google Docs / Slides / Sheets / Forms", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  const d = ok(`https://docs.google.com/document/d/${id}/edit?usp=sharing`);
  assert.equal(d.embedUrl, `https://docs.google.com/document/d/${id}/preview`);
  assert.equal(d.downloadUrl, `https://docs.google.com/document/d/${id}/export?format=pdf`);
  const s = ok(`https://docs.google.com/presentation/d/${id}/edit`);
  assert.equal(s.embedUrl, `https://docs.google.com/presentation/d/${id}/preview`);
  assert.equal(s.downloadUrl, `https://docs.google.com/presentation/d/${id}/export/pdf`);
  assert.equal(ok(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`).downloadUrl, `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
  const f = ok(`https://docs.google.com/forms/d/e/1FAIpQLSdAbCdEfGhIjKlMnOp/viewform`);
  assert.match(f.embedUrl!, /viewform\?embedded=true$/);
  assert.equal(ok(`https://docs.google.com/document/d/e/2PACX-1vAbCdEfGhIjKlMnOpQrS/pub`).embedUrl!.endsWith("/pub?embedded=true"), true);
  bad("https://docs.google.com/", /ไม่ถูกต้อง/);
});
t("Apps Script: only deployed web apps", () => {
  const sid = "AKfycbxAbCdEfGhIjKlMnOpQrStUvWxYz0123456789";
  const r = ok(`https://script.google.com/macros/s/${sid}/exec`);
  assert.equal(r.kind, "APPS_SCRIPT");
  assert.equal(r.embedUrl, `https://script.google.com/macros/s/${sid}/exec`);
  bad(`https://script.google.com/macros/s/${sid}/dev`, /exec/);
  bad("https://script.google.com/home/projects/abc", /Deploy/);
});
t("allow-listed providers are converted to embeds", () => {
  assert.equal(ok("https://www.canva.com/design/DAFabc123/AbCdEf_gh/view?utm_content=x").embedUrl, "https://www.canva.com/design/DAFabc123/AbCdEf_gh/view?embed");
  assert.equal(ok("https://wordwall.net/embed/abc123def456").kind, "EMBED");
  assert.equal(ok("https://learningapps.org/watch?v=pab12cde").embedUrl, "https://learningapps.org/watch?v=pab12cde");
  assert.equal(ok("https://vimeo.com/123456789").embedUrl, "https://player.vimeo.com/video/123456789");
  assert.equal(ok("https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=x").embedUrl, "https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk");
  assert.match(ok("https://soundcloud.com/artist/track-name").embedUrl!, /^https:\/\/w\.soundcloud\.com\/player\/\?url=/);
  assert.equal(ok("https://sketchfab.com/3d-models/my-model-0123456789abcdef0123456789abcdef").embedUrl, "https://sketchfab.com/models/0123456789abcdef0123456789abcdef/embed");
  assert.equal(ok("https://heyzine.com/flip-book/abc123.html").kind, "EMBED");
  assert.equal(ok("https://fliphtml5.com/abcd/efgh").embedUrl, "https://fliphtml5.com/abcd/efgh/");
  assert.equal(ok("https://anyflip.com/abcd/efgh/").kind, "EMBED");
});
t("an allow-listed site but a page that is not embeddable stays a plain link", () => {
  const r = ok("https://www.canva.com/");
  assert.equal(r.kind, "LINK");
  assert.equal(r.embedUrl, null);
  assert.equal(ok("https://wordwall.net/resource/12345/some-quiz").embedUrl, null);
});
t("everything else is a plain link (opened in a new tab, never framed)", () => {
  for (const u of ["https://kahoot.it/challenge/123", "https://www.liveworksheets.com/abc", "https://sites.google.com/view/myschool", "https://example.go.th/files/a.pdf"]) {
    const r = ok(u);
    assert.equal(r.kind, "LINK", u);
    assert.equal(r.embedUrl, null, u);
    assert.equal(isFrameable(r.embedUrl), false);
  }
});
t("dangerous or unusable links are refused", () => {
  bad("javascript:alert(1)", /https/);
  bad("data:text/html,<script>alert(1)</script>", /https/);
  bad("http://example.com/x", /https/);
  bad("ftp://example.com/x", /https/);
  bad("https://user:pass@example.com/x", /รหัสผ่าน/);
  bad("https://localhost/x", /สาธารณะ/);
  bad("https://127.0.0.1/x", /สาธารณะ/);
  bad("https://192.168.1.5/x", /สาธารณะ/);
  bad("https://intranet/x", /สาธารณะ/);
  bad("https://printer.local/x", /สาธารณะ/);
  bad("", /ลิงก์/);
  bad("not a link at all", /ไม่ถูกต้อง|สาธารณะ/);
  bad(`https://example.com/${"a".repeat(600)}`, /ยาวเกินไป/);
});
t("look-alike hosts do not get embedded", () => {
  assert.equal(ok("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ").kind, "LINK");
  assert.equal(ok("https://evil.example/https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view").kind, "LINK");
  assert.equal(ok("https://notcanva.com/design/DAFabc123/AbCdEf_gh/view").embedUrl, null);
});
t("isFrameable: only known hosts over https", () => {
  assert.equal(isFrameable("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"), true);
  assert.equal(isFrameable("https://drive.google.com/file/d/x/preview"), true);
  assert.equal(isFrameable("http://drive.google.com/file/d/x/preview"), false);
  assert.equal(isFrameable("https://evil.example/embed"), false);
  assert.equal(isFrameable("https://drive.google.com.evil.example/x"), false);
  assert.equal(isFrameable("javascript:alert(1)"), false);
  assert.equal(isFrameable(null), false);
});

console.log(`embed: ${passed} passed`);
