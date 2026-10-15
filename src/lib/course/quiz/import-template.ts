/** The Excel template for importing multiple-choice questions: a "how to" tab and the tab to fill in (server only: uses exceljs). */
import ExcelJS from "exceljs";
import { MAX_QUESTIONS_PER_QUIZ, EXAMPLE_PREFIX, QUIZ_SHEET_NAME, THAI_LETTERS } from "./import";

const HEADER = ["ข้อที่", "คำถาม", ...THAI_LETTERS.slice(0, 6).map((l) => `ตัวเลือก ${l}`), "เฉลย", "คะแนน", "คำอธิบายเฉลย", "ลิงก์รูปประกอบ"];
const WIDTHS = [8, 46, 22, 22, 22, 22, 22, 22, 12, 9, 38, 34];

const EXAMPLES: (string | number)[][] = [
  [1, `${EXAMPLE_PREFIX} เมืองหลวงของประเทศไทยคือข้อใด`, "กรุงเทพมหานคร", "เชียงใหม่", "ขอนแก่น", "ภูเก็ต", "", "", "ก", 1, "กรุงเทพมหานครเป็นเมืองหลวงของประเทศไทย", ""],
  [2, `${EXAMPLE_PREFIX} ข้อใดเป็นจังหวัดในภาคเหนือ (มีคำตอบที่ถูกมากกว่า 1 ข้อ)`, "เชียงใหม่", "ลำปาง", "ระยอง", "น่าน", "", "", "ก,ข,ง", 2, "ระยองอยู่ภาคตะวันออก", ""],
  [3, `${EXAMPLE_PREFIX} 6 × 7 เท่ากับเท่าไร`, "36", "42", "48", "", "", "", "ข", 1, "", ""],
];

type Row = { text: string; style?: "title" | "h" | "bold" | "note" };

const GUIDE: Row[] = [
  { text: "แม่แบบนำเข้าข้อสอบปรนัย", style: "title" },
  { text: "ใช้นำเข้าข้อสอบแบบเลือกคำตอบ (ก ข ค ง) หลายข้อเข้าแบบทดสอบในครั้งเดียว", style: "note" },
  { text: "" },
  { text: "วิธีใช้ 5 ขั้นตอน", style: "h" },
  { text: "1) ไปที่แท็บ “แบบทดสอบ” (แท็บถัดไป) ลบแถวตัวอย่าง 3 แถวแรก หรือเก็บไว้ก็ได้ — แถวที่คำถามขึ้นต้นด้วย “(ตัวอย่าง)” ระบบจะข้ามให้เอง" },
  { text: "2) พิมพ์ข้อสอบ 1 ข้อ ต่อ 1 แถว อย่าลบหรือเปลี่ยนชื่อหัวคอลัมน์ในแถวแรก" },
  { text: "3) บันทึกเป็นไฟล์ Excel (.xlsx) หรือ CSV UTF-8" },
  { text: "4) เข้าหน้าแก้ไขแบบทดสอบในระบบ กดปุ่ม “นำเข้าจาก Excel” แล้วเลือกไฟล์" },
  { text: "5) ระบบแสดงตัวอย่างให้ตรวจก่อน แถวที่มีปัญหาจะบอกเหตุผล แล้วกด “นำเข้า” — ข้อสอบจะถูกเพิ่มต่อท้ายคำถามเดิม (ไม่ลบของเดิม) และแก้ไขรายข้อได้ภายหลัง" },
  { text: "" },
  { text: "คำอธิบายแต่ละคอลัมน์", style: "h" },
  { text: "ข้อที่ — ไม่บังคับ ไว้ให้คุณนับข้อเอง ระบบไม่ใช้" },
  { text: "คำถาม — ต้องกรอก ข้อความโจทย์ (ขึ้นบรรทัดใหม่ในช่องด้วย Alt + Enter)" },
  { text: "ตัวเลือก ก ถึง ฉ — ต้องมีอย่างน้อย 2 ตัวเลือก ใส่ได้สูงสุด 8 ตัวเลือก (ก ข ค ง จ ฉ ช ซ) ถ้าต้องการเกิน 6 ให้เพิ่มคอลัมน์ “ตัวเลือก ช” “ตัวเลือก ซ” ต่อท้ายคอลัมน์ ฉ ตัวเลือกที่ไม่ใช้ปล่อยว่างได้" },
  { text: "เฉลย — ต้องกรอก คำตอบที่ถูก" },
  { text: "      • ข้อที่ถูกข้อเดียว: ใส่ ก หรือ ข หรือ ค ... (ใช้ A B C D หรือ 1 2 3 4 แทนก็ได้)", style: "note" },
  { text: "      • ข้อที่ถูกหลายข้อ: คั่นด้วยเครื่องหมายจุลภาค เช่น ก,ค หรือ ข,ค,ง — ระบบจะตั้งเป็น “เลือกได้หลายข้อ” ให้เอง", style: "note" },
  { text: "      • ข้อที่ถูกข้อเดียวระบบตั้งเป็น “เลือกคำตอบเดียว” ให้เอง", style: "note" },
  { text: "คะแนน — ไม่บังคับ เลขจำนวนเต็ม 1–100 ถ้าเว้นว่างจะได้ข้อละ 1 คะแนน" },
  { text: "คำอธิบายเฉลย — ไม่บังคับ ข้อความอธิบายที่ผู้เรียนเห็นหลังส่งคำตอบ (ตามการตั้งค่าการแสดงเฉลยของแบบทดสอบ)" },
  { text: "ลิงก์รูปประกอบ — ไม่บังคับ ลิงก์รูปจาก Google Drive (แชร์เป็น “ทุกคนที่มีลิงก์”) หรือที่อยู่รูปแบบ https://…" },
  { text: "" },
  { text: "ข้อควรรู้", style: "h" },
  { text: `• แบบทดสอบหนึ่งชุดมีคำถามได้ไม่เกิน ${MAX_QUESTIONS_PER_QUIZ} ข้อ (รวมข้อที่มีอยู่แล้ว)` },
  { text: "• ใช้นำเข้าได้เฉพาะข้อสอบปรนัย ส่วนข้อสอบชนิดอื่น (จับคู่ เรียงลำดับ เติมช่องว่าง ฯลฯ) สร้างในหน้าแก้ไขแบบทดสอบตามเดิม" },
  { text: "• ถ้าเฉลย “ก,ข” หลายข้อ ตอนนำเข้าเลือกได้ว่าจะให้คะแนนบางส่วน (ตอบถูกบางข้อได้คะแนนบางส่วน) หรือต้องถูกครบทุกข้อจึงได้คะแนน" },
  { text: "• อย่าใส่สูตร Excel ในช่อง และอย่าเว้นแถวว่างคั่น (แถวว่างระบบข้ามให้)" },
  { text: "• นำเข้าไม่ผ่านบางแถว ไม่ต้องกังวล: ระบบนำเข้าเฉพาะแถวที่ถูกต้อง และบอกเลขแถวที่มีปัญหาเพื่อให้แก้ไขแล้วนำเข้าใหม่เฉพาะแถวนั้น" },
];

export async function buildQuizImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // tab 1: how to use
  const guide = wb.addWorksheet("วิธีใช้", { views: [{ showGridLines: false }] });
  guide.getColumn(1).width = 120;
  for (const r of GUIDE) {
    const row = guide.addRow([r.text]);
    const cell = row.getCell(1);
    cell.alignment = { wrapText: true, vertical: "top" };
    if (r.style === "title") { cell.font = { bold: true, size: 18, color: { argb: "FF0B2A6F" } }; row.height = 30; }
    else if (r.style === "h") { cell.font = { bold: true, size: 13, color: { argb: "FF0052FF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF0FF" } }; }
    else if (r.style === "note") cell.font = { color: { argb: "FF555555" } };
    else cell.font = { size: 11 };
  }

  // tab 2: the questions
  const ws = wb.addWorksheet(QUIZ_SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(HEADER);
  EXAMPLES.forEach((r) => ws.addRow(r));
  HEADER.forEach((_, i) => { ws.getColumn(i + 1).width = WIDTHS[i]; });
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 24;
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF0FF" } }; c.border = { bottom: { style: "medium", color: { argb: "FF0052FF" } } }; });
  head.getCell(HEADER.indexOf("เฉลย") + 1).note = "ข้อเดียว: ก   หลายข้อ: ก,ค   (หรือ A B C D / 1 2 3 4)";
  head.getCell(2).note = "1 แถว = 1 ข้อ ขึ้นบรรทัดใหม่ในช่องด้วย Alt + Enter";
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    row.font = { color: { argb: "FF888888" }, italic: true }; // the grey examples
  });
  // 200 pre-formatted empty rows so the sheet looks ready to fill
  for (let i = 0; i < 100; i++) ws.addRow([]).alignment = { vertical: "top", wrapText: true };
  ws.getColumn(HEADER.indexOf("เฉลย") + 1).alignment = { horizontal: "center", vertical: "top" };
  ws.getColumn(HEADER.indexOf("คะแนน") + 1).alignment = { horizontal: "center", vertical: "top" };

  wb.views = [{ x: 0, y: 0, width: 20000, height: 20000, firstSheet: 0, activeTab: 1, visibility: "visible" }]; // open on the question tab
  return Buffer.from(await wb.xlsx.writeBuffer());
}
