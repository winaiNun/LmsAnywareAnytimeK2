/**
 * Read a spreadsheet upload into plain text cells (server only). One reader for every import in the
 * system (schools now, members later). Uses exceljs; limits keep a bad file from hurting the server.
 */
import ExcelJS from "exceljs";
import { Readable } from "node:stream";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 2000;

export type Sheet = { name: string; rows: string[][] };

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const o = v as unknown as Record<string, unknown>;
    // a hyperlink cell: the real target wins over the label; rich text / formulas: take the visible text
    if (typeof o.hyperlink === "string" && /^https?:\/\//i.test(o.hyperlink)) return o.hyperlink;
    if (typeof o.text === "string") return o.text;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if (o.result !== undefined) return cellText(o.result as ExcelJS.CellValue);
    if (typeof o.error === "string") return "";
    return "";
  }
  return String(v).trim();
}

/** ZIP signature: every .xlsx starts with "PK". Stops a renamed random file early. */
const isZip = (buf: Buffer) => buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b;

export async function readSpreadsheet(buf: Buffer, fileName: string): Promise<Sheet> {
  if (buf.length === 0) throw new Error("ไฟล์ว่างเปล่า");
  if (buf.length > MAX_UPLOAD_BYTES) throw new Error("ไฟล์ใหญ่เกิน 5 MB");

  const lower = fileName.toLowerCase();
  const wb = new ExcelJS.Workbook();
  try {
    if (lower.endsWith(".csv")) {
      // strip a UTF-8 BOM (Excel adds one when saving "CSV UTF-8")
      const text = buf.toString("utf8").replace(/^﻿/, "");
      await wb.csv.read(Readable.from([text]));
    } else if (lower.endsWith(".xlsx")) {
      if (!isZip(buf)) throw new Error("not zip");
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
    } else {
      throw new Error("รองรับเฉพาะไฟล์ .xlsx หรือ .csv");
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("รองรับ")) throw e;
    throw new Error("อ่านไฟล์ไม่ได้ — ไฟล์เสียหรือไม่ใช่ไฟล์ Excel/CSV ที่ถูกต้อง");
  }

  const ws = wb.worksheets.find((w) => w.rowCount > 0);
  if (!ws) throw new Error("ไม่พบข้อมูลในไฟล์");
  if (ws.rowCount > MAX_ROWS + 1) throw new Error(`มีข้อมูลเกิน ${MAX_ROWS} แถว ให้แบ่งไฟล์ก่อนนำเข้า`);

  const rows: string[][] = [];
  const width = ws.columnCount;
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value));
    rows.push(cells);
  });
  return { name: ws.name, rows };
}

/** Build a one-sheet .xlsx (used for templates and exports). Returns the file bytes. */
export async function buildSpreadsheet(sheetName: string, header: string[], rows: (string | number | null)[][], widths?: number[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(header);
  rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF0FF" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  header.forEach((_, i) => { ws.getColumn(i + 1).width = widths?.[i] ?? 24; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
