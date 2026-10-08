/* Run with: npm run test:schools */
import assert from "node:assert/strict";
import { SCHOOLS_PER_PAGE, compareThai, filterOptions, matchesQuery, pickRandom, querySchools, schoolsHref, sortName, type SchoolListItem } from "../src/lib/schools-data";
import { duplicateNames, mapHeaders, validateRows } from "../src/lib/schools-import";
import { generateTempPassword } from "../src/lib/password";

let passed = 0;
const t = (name: string, fn: () => void) => { try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${(e as Error).message}`); process.exitCode = 1; } };

const mk = (code: string, name: string, district: string, center: string, extra: Partial<SchoolListItem> = {}): SchoolListItem =>
  ({ id: code, code, name, district, center, siteUrl: null, cardUrl: null, updatedAt: 0, ...extra });

const SAMPLE = [
  mk("30020009", "โรงเรียนบ้านตะกุดเครือปลอก", "จักราช", "จักราช 1"),
  mk("30020010", "โรงเรียนบ้านโนนพฤกษ์", "จักราช", "จักราช 1"),
  mk("30020029", "โรงเรียนบ้านหนองไผ่", "จักราช", "จักราช 2"),
  mk("30020101", "โรงเรียนบ้านหนองไผ่", "ห้วยแถลง", "ห้วยแถลง 1"),
  mk("30020150", "โรงเรียนเฉลิมพระเกียรติสมเด็จพระเทพ", "เฉลิมพระเกียรติ", "เฉลิมพระเกียรติ 1"),
  mk("30020151", "โรงเรียนไทยรัฐวิทยา", "โชคชัย", "โชคชัย 1"),
  mk("30020152", "โรงเรียนอนุบาลโชคชัย", "โชคชัย", "โชคชัย 10"),
  mk("30020153", "โรงเรียนอนุบาลโชคชัย", "โชคชัย", "โชคชัย 2"),
];

t("Thai dictionary order ignores 'โรงเรียน' and leading vowels", () => {
  assert.equal(sortName("โรงเรียนบ้านหนองไผ่"), "บ้านหนองไผ่");
  assert.equal(sortName("  โรงเรียน เฉลิมพระเกียรติ"), "เฉลิมพระเกียรติ");
  // เฉลิม… (leading vowel เ + ฉ) sorts under ฉ, i.e. after ก-ข-ค and before ช, not before ก
  const sorted = ["เฉลิม", "จักราช", "กรุงเทพ", "ชัย", "โนน", "ไทย"].sort(compareThai);
  assert.deepEqual(sorted, ["กรุงเทพ", "จักราช", "เฉลิม", "ชัย", "ไทย", "โนน"]);
  assert.ok(compareThai("ศูนย์ 2", "ศูนย์ 10") < 0, "numbers compare by value");
});

t("sorting modes", () => {
  const names = (sort: string) => querySchools(SAMPLE, { sort, perPage: 99 }).items.map((s) => s.code);
  // เฉลิม… (ฉ) < ไทยรัฐ… (ท) < บ้านตะกุด… (บ); the two "บ้านหนองไผ่" are adjacent and tie-break on code
  assert.deepEqual(names("name").slice(0, 3), ["30020150", "30020151", "30020009"]);
  const asc = names("name"); assert.deepEqual(asc.indexOf("30020029") + 1, asc.indexOf("30020101"));
  assert.deepEqual(names("name-desc"), [...asc].reverse()); // descending is the exact mirror
  assert.equal(names("name-desc")[names("name-desc").length - 1], "30020150");
  assert.deepEqual(names("code"), [...SAMPLE.map((s) => s.code)].sort());
  const byDistrict = querySchools(SAMPLE, { sort: "district", perPage: 99 }).items;
  assert.deepEqual(byDistrict.map((s) => s.district).filter((d, i, a) => a.indexOf(d) === i), ["จักราช", "เฉลิมพระเกียรติ", "โชคชัย", "ห้วยแถลง"]);
  assert.deepEqual(byDistrict.filter((s) => s.district === "โชคชัย").map((s) => s.center), ["โชคชัย 1", "โชคชัย 2", "โชคชัย 10"]); // 2 before 10
  assert.equal(querySchools(SAMPLE, { sort: "nonsense", perPage: 99 }).items.length, SAMPLE.length); // unknown sort falls back
});

t("search matches name, code, district, centre; all words must hit", () => {
  const find = (q: string) => querySchools(SAMPLE, { q, perPage: 99 }).items.map((s) => s.code);
  assert.deepEqual(find("หนองไผ่"), ["30020029", "30020101"]);
  assert.deepEqual(find("หนองไผ่ ห้วยแถลง"), ["30020101"]);
  assert.deepEqual(find("30020151"), ["30020151"]);
  assert.deepEqual(find("  จักราช   2 "), ["30020029"]); // "2" is the centre number, not part of a code
  assert.deepEqual(find("โชคชัย 10"), ["30020152"]);
  assert.deepEqual(find("3002015").length, 4); // 4+ digits match inside codes
  assert.deepEqual(find("ไม่มีแน่นอน"), []);
  assert.equal(find("   ").length, SAMPLE.length);
  assert.ok(matchesQuery(SAMPLE[0], "โรงเรียน​บ้าน")); // zero-width chars from copy/paste are ignored
});

t("district / centre filters combine with search", () => {
  assert.equal(querySchools(SAMPLE, { district: "จักราช" }).total, 3);
  assert.equal(querySchools(SAMPLE, { district: "จักราช", center: "จักราช 1" }).total, 2);
  assert.equal(querySchools(SAMPLE, { district: "ห้วยแถลง", center: "จักราช 1" }).total, 0);
  assert.equal(querySchools(SAMPLE, { district: "จักราช", q: "ไผ่" }).total, 1);
});

t("pagination clamps and never breaks", () => {
  const many = Array.from({ length: 173 }, (_, i) => mk(String(30020000 + i), `โรงเรียนที่ ${i}`, "ก", "ก 1"));
  const p1 = querySchools(many, {});
  assert.equal(p1.perPage, SCHOOLS_PER_PAGE);
  assert.equal(p1.pages, 11); // ceil(173 / 16)
  assert.equal(p1.items.length, 16);
  assert.equal(querySchools(many, { page: 11 }).items.length, 173 - 10 * 16);
  assert.equal(querySchools(many, { page: 999 }).page, 11); // past the end → last page
  assert.equal(querySchools(many, { page: -3 }).page, 1);
  assert.equal(querySchools(many, { page: Number.NaN }).page, 1);
  const none = querySchools(many, { q: "zzz" });
  assert.deepEqual([none.total, none.pages, none.page, none.items.length], [0, 1, 1, 0]);
  const seen = new Set<string>();
  for (let p = 1; p <= 11; p++) querySchools(many, { page: p }).items.forEach((s) => seen.add(s.id));
  assert.equal(seen.size, 173); // every school appears on exactly one page
});

t("filter options", () => {
  const o = filterOptions(SAMPLE);
  assert.deepEqual(o.districts, ["จักราช", "เฉลิมพระเกียรติ", "โชคชัย", "ห้วยแถลง"]);
  assert.equal(o.centers.filter((c) => c.district === "จักราช").length, 2);
});

t("random pick: right size, no repeats, deterministic with a seeded rng, safe on small lists", () => {
  const list = Array.from({ length: 173 }, (_, i) => i);
  const a = pickRandom(list, 12);
  assert.equal(a.length, 12);
  assert.equal(new Set(a).size, 12);
  let seed = 1; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const x = pickRandom(list, 12, rng); seed = 1; const y = pickRandom(list, 12, rng);
  assert.deepEqual(x, y);
  assert.equal(pickRandom([1, 2, 3], 12).length, 3);
  assert.deepEqual(pickRandom([], 12), []);
  assert.deepEqual(pickRandom([1, 2], 0), []);
  assert.equal(list.length, 173); // input untouched
  const hits = new Set<number>(); for (let i = 0; i < 400; i++) pickRandom(list, 12).forEach((n) => hits.add(n));
  assert.ok(hits.size > 150, "every school gets a chance");
});

t("schools page links", () => {
  assert.equal(schoolsHref({}), "/schools");
  assert.equal(schoolsHref({ q: " ไผ่ ", district: "จักราช", sort: "code", page: 3 }), "/schools?q=%E0%B9%84%E0%B8%9C%E0%B9%88&district=%E0%B8%88%E0%B8%B1%E0%B8%81%E0%B8%A3%E0%B8%B2%E0%B8%8A&sort=code&page=3");
  assert.equal(schoolsHref({ sort: "name", page: 1 }), "/schools");
});

const HEADER = ["รหัสโรงเรียน", "อีเมล", "อำเภอ", "ศูนย์เครือข่าย", "ชื่อโรงเรียน", "ลิงก์ Anywhere Anytime", "ลิงก์การ์ด"];
const DRIVE = "https://drive.google.com/file/d/1E5PTZ1b79zjWH_5p5uDhSNlr9b6GWqO6/view?usp=sharing";

t("header mapping: the real file, variants, and missing columns", () => {
  const m = mapHeaders(HEADER);
  assert.deepEqual(m.index, { code: 0, email: 1, district: 2, center: 3, name: 4, siteUrl: 5, card: 6 });
  assert.deepEqual(m.missing, []);
  const v = mapHeaders([" รหัส ", "E-mail", "อำเภอ:", "ศูนย์", "ชื่อ", "เว็บไซต์", "การ์ด "]);
  assert.deepEqual(v.index, { code: 0, email: 1, district: 2, center: 3, name: 4, siteUrl: 5, card: 6 });
  const partial = mapHeaders(["ชื่อโรงเรียน", "อำเภอ"]);
  assert.deepEqual(partial.missing.sort(), ["center", "code"]);
  assert.ok(mapHeaders(["CODE", "name", "District", "Center"]).missing.length === 0);
});

t("row validation", () => {
  const idx = mapHeaders(HEADER).index;
  const ok = ["30020009", "30020009@korat2.go.th", "จักราช", "จักราช 1", "โรงเรียนบ้านตะกุดเครือปลอก", "https://sites.google.com/korat2.go.th/a/anywhere-anytime", DRIVE];
  const rows = validateRows(
    [
      ok,
      ["30020010", "BAD EMAIL", "จักราช", "จักราช 1", "โรงเรียน ก", "https://x.example/y", DRIVE],                   // bad email
      ["30020028", "30020028@korat2.go.th", "จักราช", "จักราช 1", "โรงเรียน ข", "(ไม่มีลิงก์)", DRIVE],             // no site link: warning only
      ["30020009", "other@korat2.go.th", "จักราช", "จักราช 1", "โรงเรียน ค", "", DRIVE],                          // duplicate code
      ["30020040", "30020009@korat2.go.th", "จักราช", "จักราช 1", "โรงเรียน ง", "", DRIVE],                       // duplicate email
      ["30020041", "", "", "จักราช 1", "", "", ""],                                                              // missing name, district
      ["abc", "x@y.th", "จักราช", "จักราช 1", "โรงเรียน จ", "https://", DRIVE],                                   // bad code, broken URL
      ["30020050", "30020050@korat2.go.th", "จักราช", "จักราช 1", "โรงเรียน ฉ", "https://sites.google.com/korat2.go.th/a/anywhere-anytime", "https://example.com/card.png"], // shared link, non-Drive card
      ["", "", "", "", "", "", ""],                                                                              // blank row ignored
    ],
    idx,
  );
  assert.equal(rows.length, 8);
  const by = (code: string, n = 0) => rows.filter((r) => r.code === code)[n];
  assert.deepEqual(by("30020009").errors, []);
  assert.ok(by("30020010").errors.some((e) => e.includes("อีเมล")));
  assert.deepEqual(by("30020028").errors, []);
  assert.equal(by("30020028").siteUrl, null);
  assert.ok(by("30020028").warnings.some((w) => w.includes("ไม่มีลิงก์")));
  assert.ok(by("30020009", 1).errors.some((e) => e.includes("รหัสโรงเรียนซ้ำ")));
  assert.ok(by("30020040").errors.some((e) => e.includes("อีเมลซ้ำ")));
  assert.ok(by("30020041").errors.length >= 2);
  assert.ok(by("abc").errors.some((e) => e.includes("รหัส")) && by("abc").errors.some((e) => e.includes("ลิงก์")));
  assert.ok(by("30020050").warnings.some((w) => w.includes("ซ้ำกับรหัส 30020009")));
  assert.equal(by("30020050").cardSourceUrl, null);
  assert.equal(rows[0].line, 2); // line numbers match the spreadsheet (header is line 1)
  assert.equal(rows[7].line, 9);
  assert.equal(by("30020009").email, "30020009@korat2.go.th");
});

t("same name in two districts is allowed and reported", () => {
  const idx = mapHeaders(HEADER).index;
  const rows = validateRows([
    ["30020029", "a@x.th", "จักราช", "จักราช 2", "โรงเรียนบ้านหนองไผ่", "https://a.example", DRIVE],
    ["30020101", "b@x.th", "ห้วยแถลง", "ห้วยแถลง 1", "โรงเรียนบ้านหนองไผ่", "https://b.example", DRIVE],
  ], idx);
  assert.ok(rows.every((r) => r.errors.length === 0));
  assert.equal(duplicateNames(rows).get("โรงเรียนบ้านหนองไผ่")?.length, 2);
});

t("temporary passwords: length, alphabet (no look-alikes), uniqueness", () => {
  const set = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const p = generateTempPassword();
    assert.equal(p.length, 10);
    assert.ok(/^[A-HJ-NP-Za-km-z2-9]{10}$/.test(p), p);
    set.add(p);
  }
  assert.equal(set.size, 2000);
  assert.equal(generateTempPassword(16).length, 16);
});

console.log(process.exitCode ? "\nSchool tests FAILED" : `All ${passed} school test groups passed`);
