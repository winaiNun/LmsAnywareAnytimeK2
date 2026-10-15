// Excel import of multiple-choice questions: the reader/validator and the template. Run: npm run test:quizimport
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { readSpreadsheet } from "../src/lib/excel";
import { parseAnswerCell, parseQuizSheet } from "../src/lib/course/quiz/import";
import { buildQuizImportTemplate } from "../src/lib/course/quiz/import-template";

const H = ["ข้อที่", "คำถาม", "ตัวเลือก ก", "ตัวเลือก ข", "ตัวเลือก ค", "ตัวเลือก ง", "เฉลย", "คะแนน", "คำอธิบายเฉลย", "ลิงก์รูปประกอบ"];
let groups = 0;
const group = async (_name: string, fn: () => void | Promise<void>) => { await fn(); groups++; };

async function main() {
  await group("answer cell: Thai letters, A-D, digits, several answers", () => {
    assert.deepEqual(parseAnswerCell("ก"), { positions: [0], bad: null });
    assert.deepEqual(parseAnswerCell("ข,ค"), { positions: [1, 2], bad: null });
    assert.deepEqual(parseAnswerCell(" ก , ง "), { positions: [0, 3], bad: null });
    assert.deepEqual(parseAnswerCell("B C"), { positions: [1, 2], bad: null });
    assert.deepEqual(parseAnswerCell("c"), { positions: [2], bad: null });
    assert.deepEqual(parseAnswerCell("2 และ 4"), { positions: [1, 3], bad: null });
    assert.deepEqual(parseAnswerCell("๓"), { positions: [2], bad: null }, "Thai digit");
    assert.deepEqual(parseAnswerCell("ข."), { positions: [1], bad: null });
    assert.deepEqual(parseAnswerCell("(ค)"), { positions: [2], bad: null });
    assert.deepEqual(parseAnswerCell("ก,ก"), { positions: [0], bad: null }, "no duplicates");
    assert.equal(parseAnswerCell("ฮ").bad, "ฮ");
    assert.equal(parseAnswerCell("9").bad, "9");
    assert.equal(parseAnswerCell("ก,ฮ").bad, "ฮ");
  });

  await group("header found even under a title; missing columns are named", () => {
    const ok = parseQuizSheet([["แบบทดสอบบทที่ 1"], H, ["1", "2+2?", "3", "4", "", "", "ข", "", "", ""]]);
    assert.ok(ok.ok && ok.valid === 1);
    const no = parseQuizSheet([["คำถาม", "ตัวเลือก ก", "ตัวเลือก ข"], ["a", "b", "c"]]);
    assert.ok(!no.ok && no.error.includes("เฉลย"));
    const no2 = parseQuizSheet([["คำถาม", "เฉลย"], ["a", "ก"]]);
    assert.ok(!no2.ok && no2.error.includes("ตัวเลือก"));
    assert.ok(!parseQuizSheet([]).ok);
    // alternative header spellings
    const alt = parseQuizSheet([["โจทย์", "ก", "ข", "ค", "คำตอบ"], ["ข้อสอบหนึ่ง", "ส้ม", "แอปเปิล", "", "ข"]]);
    assert.ok(alt.ok && alt.rows[0].question?.type === "SINGLE");
  });

  await group("one right answer = SINGLE, several = MULTI (all or partial), ids follow the columns", () => {
    const r = parseQuizSheet([H, ["1", "ข้อหนึ่ง", "ก1", "ข1", "ค1", "ง1", "ค", "3", "เพราะว่า", ""], ["2", "ข้อสอง", "ก2", "ข2", "ค2", "ง2", "ก,ง", "", "", ""]]);
    assert.ok(r.ok);
    if (!r.ok) return;
    const [a, b] = r.rows;
    assert.equal(a.question?.type, "SINGLE");
    assert.deepEqual(a.question?.answerKey, { correctId: "c3" });
    assert.equal(a.question?.points, 3);
    assert.equal(a.question?.explanation, "เพราะว่า");
    assert.equal(b.question?.type, "MULTI");
    assert.deepEqual(b.question?.answerKey, { correctIds: ["c1", "c4"] });
    assert.equal((b.question?.config as { scoring: string }).scoring, "all");
    assert.equal(b.points, 1, "empty points = 1");
    const partial = parseQuizSheet([H, ["2", "ข้อสอง", "a", "b", "c", "d", "ก,ข", "", "", ""]], { partialScoring: true });
    assert.ok(partial.ok && (partial.rows[0].question?.config as { scoring: string }).scoring === "partial");
  });

  await group("a gap in the choices keeps the letters; an answer pointing at a gap is refused", () => {
    const r = parseQuizSheet([H, ["1", "q", "ตัวแรก", "", "ตัวที่สาม", "", "ค", "", "", ""], ["2", "q", "ตัวแรก", "", "ตัวที่สาม", "", "ข", "", "", ""]]);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.rows[0].question?.answerKey, { correctId: "c3" }, "ค is still the third column");
    assert.deepEqual(r.rows[0].choices, ["ตัวแรก", "ตัวที่สาม"]);
    assert.ok(r.rows[1].errors.some((e) => e.includes("ว่าง")));
  });

  await group("every kind of mistake is reported on its own row, with the sheet row number", () => {
    const r = parseQuizSheet([
      H,
      ["", "", "x", "y", "", "", "ก", "", "", ""], // no question
      ["", "q", "only one", "", "", "", "ก", "", "", ""], // one choice
      ["", "q", "a", "b", "", "", "", "", "", ""], // no answer
      ["", "q", "a", "b", "", "", "ฮ", "", "", ""], // unknown answer
      ["", "q", "a", "b", "", "", "ก", "0", "", ""], // points out of range
      ["", "q", "a", "b", "", "", "ก", "1.5", "", ""], // not a whole number
      ["", "q", "a", "b", "", "", "ก", "", "", "ftp://x"], // bad picture link
      ["", "q", "a", "b", "", "", "ก", "", "", "https://example.com/p.png"], // fine
      ["", "q", "a", "b", "", "", "b", "", "", ""], // answer by letter B
      ["", "q", "สี", "รูป", "", "", "รูป", "", "", ""], // answer written as the choice text
    ]);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.rows.map((x) => x.rowNo), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    assert.ok(r.rows[0].errors.includes("ไม่มีคำถาม"));
    assert.ok(r.rows[1].errors.some((e) => e.includes("อย่างน้อย 2")));
    assert.ok(r.rows[2].errors.some((e) => e.includes("ไม่ได้ระบุเฉลย")));
    assert.ok(r.rows[3].errors.some((e) => e.includes("ไม่เข้าใจ")));
    assert.ok(r.rows[4].errors.some((e) => e.includes("1–100")));
    assert.ok(r.rows[5].errors.some((e) => e.includes("1–100")));
    assert.ok(r.rows[6].errors.some((e) => e.includes("ลิงก์รูป")));
    assert.ok(r.rows[7].question, "https picture accepted");
    assert.ok(r.rows[8].question, "B = second choice");
    assert.deepEqual(r.rows[9].question?.answerKey, { correctId: "c2" }, "answer typed as the text of the choice");
    assert.equal(r.valid, 3);
    assert.equal(r.invalid, 7);
  });

  await group("empty rows are skipped, (ตัวอย่าง) rows are skipped and counted, too-long text is refused", () => {
    const r = parseQuizSheet([H, ["", "", "", "", "", "", "", "", "", ""], ["1", "(ตัวอย่าง) q", "a", "b", "", "", "ก", "", "", ""], ["2", "จริง", "a", "b", "", "", "ก", "", "", ""]]);
    assert.ok(r.ok && r.rows.length === 1 && r.exampleRows === 1 && r.valid === 1);
    const only = parseQuizSheet([H, ["1", "(ตัวอย่าง) q", "a", "b", "", "", "ก", "", "", ""]]);
    assert.ok(!only.ok && only.error.includes("แถวตัวอย่าง"));
    assert.ok(!parseQuizSheet([H]).ok);
    const long = parseQuizSheet([H, ["", "ก".repeat(2001), "a", "b", "", "", "ก", "", "", ""], ["", "q", "ก".repeat(301), "b", "", "", "ก", "", "", ""]]);
    assert.ok(long.ok && long.invalid === 2, "over-long question and over-long choice are refused (same limits as the builder)");
    const dup = parseQuizSheet([H, ["", "q", "เหมือน", "เหมือน", "", "", "ก", "", "", ""]]);
    assert.ok(dup.ok && dup.rows[0].question && dup.rows[0].warnings.length === 1, "duplicate choices only warn");
  });

  await group("the template: opens on the question tab, reads back to nothing but examples, and example rows parse when un-marked", async () => {
    const file = await buildQuizImportTemplate();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file as unknown as ArrayBuffer);
    assert.deepEqual(wb.worksheets.map((w) => w.name), ["วิธีใช้", "แบบทดสอบ"]);
    const sheet = await readSpreadsheet(file, "t.xlsx", "แบบทดสอบ");
    assert.equal(sheet.name, "แบบทดสอบ", "the question tab is read, not the how-to tab");
    const parsed = parseQuizSheet(sheet.rows);
    assert.ok(!parsed.ok && parsed.error.includes("แถวตัวอย่าง"), "an untouched template has only example rows");
    const unmarked = sheet.rows.map((r, i) => (i === 0 ? r : r.map((c, j) => (j === 1 ? c.replace("(ตัวอย่าง) ", "") : c))));
    const real = parseQuizSheet(unmarked);
    assert.ok(real.ok && real.valid === 3 && real.invalid === 0);
    if (real.ok) {
      assert.equal(real.rows[0].question?.type, "SINGLE");
      assert.equal(real.rows[1].question?.type, "MULTI");
      assert.equal(real.rows[1].question?.points, 2);
      assert.deepEqual(real.rows[2].question?.answerKey, { correctId: "c2" });
    }
    // without the preferred name the reader falls back to the first tab (the how-to tab), which is not a question sheet
    const fallback = await readSpreadsheet(file, "t.xlsx");
    assert.equal(fallback.name, "วิธีใช้");
  });

  console.log(`quiz import: ${groups} groups passed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
