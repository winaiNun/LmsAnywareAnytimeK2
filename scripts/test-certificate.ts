// Pure certificate rules. Run: npm run test:cert
import assert from "node:assert/strict";
import { FIELD_KEYS, canDownload, certValues, defaultFields, formatSerialNumber, parseFields, patternProblem, pickDesign, renderTemplate, takeNumber } from "../src/lib/certificate/schema";

let groups = 0;
const group = (name: string, fn: () => void) => { fn(); groups++; void name; };

group("parseFields: always 7 fields in order, bad values fall back", () => {
  assert.deepEqual(parseFields(null).map((f) => f.key), [...FIELD_KEYS]);
  assert.deepEqual(parseFields("junk"), defaultFields());
  const f = parseFields([
    { key: "name", enabled: false, text: "x".repeat(500), x: -5, y: 250, w: 0, size: 9999, color: "red", align: "middle", font: "comic" },
    { key: "bogus", enabled: true },
    { key: "date", color: "#ABCDEF", font: "f:abc_1", size: "30" },
  ]);
  const name = f.find((x) => x.key === "name")!;
  assert.equal(name.enabled, false);
  assert.equal(name.text.length, 200);
  assert.equal(name.x, 0); assert.equal(name.y, 100); assert.equal(name.w, 1); assert.equal(name.size, 200);
  assert.equal(name.color, "#1a1a1a"); assert.equal(name.align, "center"); assert.equal(name.font, "sarabun-700");
  const date = f.find((x) => x.key === "date")!;
  assert.equal(date.color, "#abcdef"); assert.equal(date.font, "f:abc_1"); assert.equal(date.size, 30);
  assert.equal(f.length, 7);
});

group("renderTemplate", () => {
  assert.equal(renderTemplate("เลขที่ {number}", { number: "0001/2569" }), "เลขที่ 0001/2569");
  assert.equal(renderTemplate("ผลคะแนน {score}%", { score: "" }), "ผลคะแนน %");
  assert.equal(renderTemplate("{typo} {name}", { name: "ก" }), "{typo} ก", "an unknown token stays visible");
  assert.equal(renderTemplate("  a   {name}  ", { name: "b" }), "a b");
});

group("certValues: long Thai dates in พ.ศ., no number yet", () => {
  const v = certValues({ name: "นายวินัย หนุนกระโทก", number: null, completedAt: new Date("2026-10-11T05:00:00Z"), issuedAt: null, course: "C", scorePercent: 90, hours: 6, instructor: null, school: null, code: "ABC" });
  assert.equal(v.date, "11 ตุลาคม 2569");
  assert.equal(v.number, ""); assert.equal(v.issued, ""); assert.equal(v.score, "90"); assert.equal(v.hours, "6"); assert.equal(v.instructor, "");
  assert.equal(certValues({ name: "x", number: "1", completedAt: new Date(), issuedAt: new Date("2026-12-31T17:30:00Z"), course: "c", scorePercent: null, hours: null, instructor: null, school: null, code: "x" }).issued, "1 มกราคม 2570", "Bangkok midnight crosses the year");
});

group("patternProblem", () => {
  assert.equal(patternProblem("{no}/{year}"), null);
  assert.equal(patternProblem("ศธ 04001/{no}"), null);
  assert.ok(patternProblem(""));
  assert.ok(patternProblem("{year}"), "needs {no}");
  assert.ok(patternProblem("{no}/{yr}"));
  assert.ok(patternProblem("{no}/{year"));
  assert.ok(patternProblem("{no}".repeat(20)));
});

group("serial numbers run, pad and restart each พ.ศ.", () => {
  assert.equal(formatSerialNumber("{no}/{year}", 7, 4, 2569), "0007/2569");
  assert.equal(formatSerialNumber("{no}", 12345, 4, 2569), "12345", "never cut a long number");
  let s = { pattern: "{no}/{year}", padding: 4, nextNo: 1, resetYearly: true, lastYear: null as number | null };
  const a = takeNumber(s, new Date("2026-10-11T05:00:00Z"));
  assert.equal(a.number, "0001/2569"); s = a.next;
  const b = takeNumber(s, new Date("2026-10-12T05:00:00Z"));
  assert.equal(b.number, "0002/2569"); s = b.next;
  const c = takeNumber(s, new Date("2027-01-02T05:00:00Z"));
  assert.equal(c.number, "0001/2570", "new year restarts"); s = c.next;
  assert.equal(s.nextNo, 2);
  const keep = takeNumber({ ...s, resetYearly: false, nextNo: 50 }, new Date("2028-01-02T05:00:00Z"));
  assert.equal(keep.number, "0050/2571", "no reset when switched off");
});

group("pickDesign: highest reached score, else the default", () => {
  const ds = [
    { id: "base", isDefault: true, minScore: null, position: 0 },
    { id: "good", isDefault: false, minScore: 80, position: 1 },
    { id: "best", isDefault: false, minScore: 95, position: 2 },
  ];
  assert.equal(pickDesign(ds, 100)?.id, "best");
  assert.equal(pickDesign(ds, 85)?.id, "good");
  assert.equal(pickDesign(ds, 50)?.id, "base");
  assert.equal(pickDesign(ds, null)?.id, "base");
  assert.equal(pickDesign([], 90), null);
  assert.equal(pickDesign([{ id: "only", isDefault: false, minScore: 70, position: 0 }], 10)?.id, "only", "falls back to the first one");
});

group("only an issued certificate may be downloaded", () => {
  assert.equal(canDownload("ISSUED"), true);
  assert.equal(canDownload("PENDING"), false);
  assert.equal(canDownload("REVOKED"), false);
});

console.log(`certificate rules: ${groups} groups passed`);
