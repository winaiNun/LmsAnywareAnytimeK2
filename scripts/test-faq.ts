import assert from "node:assert/strict";
import { clean, dice, keywordList, matchFaq, normaliseQuestion, scoreEntry, tokens, type FaqEntry } from "../src/lib/faq/match";

const faq: FaqEntry[] = [
  { id: "reg", question: "สมัครสมาชิกอย่างไร", keywords: "สมัคร, ลงทะเบียนเข้าใช้, รหัสสมัคร, สร้างบัญชี" },
  { id: "pwd", question: "ลืมรหัสผ่านต้องทำอย่างไร", keywords: "ลืมรหัส, รีเซ็ตรหัสผ่าน, เข้าสู่ระบบไม่ได้, login ไม่ได้" },
  { id: "cert", question: "ขอเกียรติบัตรได้ที่ไหน", keywords: "เกียรติบัตร, certificate, ใบประกาศ, ดาวน์โหลดเกียรติบัตร" },
  { id: "mobile", question: "ใช้งานบนมือถือได้ไหม", keywords: "โทรศัพท์, แอป, ติดตั้งแอป, PWA" },
  { id: "course", question: "เรียนคอร์สออนไลน์อย่างไร", keywords: "คอร์ส, เรียนออนไลน์, บทเรียน, แบบทดสอบ" },
];
const top = (q: string) => {
  const r = matchFaq(q, faq);
  return r.kind === "answer" ? `answer:${r.best.id}` : r.kind === "suggest" ? `suggest:${r.items[0].id}` : "none";
};

// 1. cleaning and tokens
assert.equal(clean("  สมัคร   ๑๒๓!! "), "สมัคร 123");
assert.ok(tokens("ลืมรหัสผ่านครับ").includes("ลืม"));
assert.ok(!tokens("ลืมรหัสผ่านครับ").includes("ครับ"));
assert.ok(!tokens("สมัครสมาชิกอย่างไรคะ").includes("คะ"));
assert.deepEqual(keywordList("สมัคร, ลงทะเบียนเข้าใช้ | a\nสร้างบัญชี"), ["สมัคร", "ลงทะเบียนเข้าใช้", "สร้างบัญชี"]);
console.log("ok clean/tokens");

// 2. exact and near-exact
assert.equal(scoreEntry("สมัครสมาชิกอย่างไร", faq[0]), 1);
assert.equal(top("สมัครสมาชิกอย่างไร"), "answer:reg");
assert.equal(top("  สมัครสมาชิกอย่างไร?? "), "answer:reg");
console.log("ok exact");

// 3. everyday phrasings land on the right entry (keywords and word overlap)
const cases: [string, string][] = [
  ["จะสมัครยังไงครับ", "reg"],
  ["ลืมรหัสผ่าน", "pwd"],
  ["เข้าสู่ระบบไม่ได้", "pwd"],
  ["อยากได้เกียรติบัตร", "cert"],
  ["ดาวน์โหลดใบประกาศ", "cert"],
  ["ใช้บนโทรศัพท์ได้ไหม", "mobile"],
  ["ติดตั้งแอปยังไง", "mobile"],
  ["เรียนออนไลน์", "course"],
];
for (const [q, id] of cases) assert.equal(top(q), `answer:${id}`, q);
console.log("ok phrasings");

// 4. the answer line: unrelated text answers nothing, empty/blank/junk too
for (const q of ["วันนี้อากาศเป็นอย่างไร", "ราคาทองวันนี้", "asdfgh", "", "   ", "???"]) assert.equal(top(q), "none", q);
console.log("ok no match");

// 5. partial overlap suggests instead of answering
const sug = matchFaq("รหัส", faq);
assert.equal(sug.kind, "suggest");
console.log("ok suggestions", sug.kind);

// 6. case does not matter; long input is cut, not crashing
assert.equal(top("PWA"), "answer:mobile");
assert.equal(top("pwa"), "answer:mobile");
assert.doesNotThrow(() => matchFaq("ก".repeat(5000), faq));
assert.equal(matchFaq("x".repeat(5000), []).kind, "none");
console.log("ok robustness");

// 7. dice and the unanswered key
assert.equal(dice("สมัคร", "สมัคร"), 1);
assert.ok(dice("สมัครสมาชิก", "สมัครสมาชิกยังไง") > 0.6);
assert.equal(dice("", "ก"), 0);
assert.equal(normaliseQuestion("ลืม รหัส ๑!"), normaliseQuestion("ลืมรหัส 1"));
assert.ok(normaliseQuestion("ก".repeat(500)).length <= 200);
console.log("ok dice/key");

// 8. ordering and related entries
const r = matchFaq("ลืมรหัสผ่านสมัครใหม่", faq);
assert.ok(r.kind === "answer" || r.kind === "suggest");
if (r.kind === "answer") assert.ok(r.related.every((m) => m.id !== r.best.id));
console.log("ok ordering");
