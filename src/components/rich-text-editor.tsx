"use client";

import { useRef, useState } from "react";
import CropImageField from "@/components/admin/crop-image-field";
import SitePageBody from "@/components/site-page-body";
import { addContentDrive, uploadContentImage } from "@/lib/content-actions";
import { driveDirective, htmlDirective, imgDirective } from "@/lib/page-markup";

const A4 = [
  { label: "A4 แนวตั้ง", value: 210 / 297 },
  { label: "A4 แนวนอน", value: 297 / 210 },
  { label: "16:9", value: 16 / 9 },
];
const btn = "min-h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium hover:border-brand/50 disabled:opacity-50";

/**
 * Text box for page / lesson text with a toolbar: insert an A4 picture (cropped and shrunk here, stored as a small WebP),
 * a Google Drive file (PDF or picture, shown as a preview card) and, on admin pages, a sandboxed HTML block. Each one
 * is a one-line directive in the text (see lib/page-markup.ts) so old pages keep working and nothing needs a migration.
 */
export default function RichTextEditor({
  name,
  defaultValue,
  rows = 16,
  maxLength,
  allowHtml = false,
  uploadsOpen,
  required = false,
  ariaLabel = "เนื้อหา",
  onChange,
}: {
  name: string;
  defaultValue: string;
  rows?: number;
  maxLength: number;
  allowHtml?: boolean;
  /** SiteSetting.allowServerUploads: when off, pictures can only come from Drive links. */
  uploadsOpen: boolean;
  required?: boolean;
  ariaLabel?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValueRaw] = useState(defaultValue);
  const setValue = (v: string) => {
    setValueRaw(v);
    onChange?.(v);
  };
  const [preview, setPreview] = useState(false);
  const [panel, setPanel] = useState<null | "img" | "drive">(null);
  const [alt, setAlt] = useState("");
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const imgPanel = useRef<HTMLDivElement>(null);

  /** Put a block on its own lines at the cursor (blank line before and after). */
  const insert = (snippet: string, cursorInside = false) => {
    const el = area.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const pre = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const post = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "\n";
    setValue(before + pre + snippet + post + after);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = before.length + pre.length + (cursorInside ? snippet.indexOf("\n") + 1 : snippet.length);
      el.setSelectionRange(pos, cursorInside ? pos + snippet.split("\n")[1].length : pos);
    });
  };
  const close = () => {
    setPanel(null);
    setMsg("");
    setAlt("");
    setLink("");
    setTitle("");
  };

  const addImage = async () => {
    const file = imgPanel.current?.querySelector<HTMLInputElement>('input[type="file"][name="file"]')?.files?.[0];
    if (!file) return setMsg("เลือกรูป ครอบ แล้วกด “ใช้รูปนี้” ในหน้าต่างครอบรูปก่อน");
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    const r = await uploadContentImage(fd).catch(() => ({ ok: false as const, error: "อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง" }));
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    insert(imgDirective(r.key, alt));
    close();
  };

  const addDrive = async () => {
    if (!link.trim()) return setMsg("วางลิงก์ไฟล์จาก Google Drive");
    setBusy(true);
    const r = await addContentDrive(link.trim()).catch(() => ({ ok: false as const, error: "ดึงภาพตัวอย่างไม่สำเร็จ ลองใหม่อีกครั้ง" }));
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    insert(driveDirective(r.id, r.thumbKey, title));
    close();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="แทรกเนื้อหา">
        <button type="button" className={btn} onClick={() => { setPanel(panel === "img" ? null : "img"); setMsg(""); }} aria-expanded={panel === "img"}>แทรกรูป A4</button>
        <button type="button" className={btn} onClick={() => { setPanel(panel === "drive" ? null : "drive"); setMsg(""); }} aria-expanded={panel === "drive"}>แทรกลิงก์ Drive / PDF</button>
        {allowHtml && <button type="button" className={btn} onClick={() => insert(htmlDirective("<!-- วางโค้ด HTML ที่นี่ -->"), true)}>แทรก HTML</button>}
        <button type="button" className={`${btn} ml-auto`} onClick={() => setPreview((v) => !v)} aria-pressed={preview}>{preview ? "กลับไปแก้ไข" : "ดูตัวอย่าง"}</button>
      </div>

      {panel === "img" && (
        <div className="space-y-3 rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
          {uploadsOpen ? (
            <>
              <div ref={imgPanel}>
                <CropImageField name="file" label="เลือกรูป แล้วครอบเป็น A4" aspects={A4} maxWidth={1240} />
              </div>
              <label className="block space-y-1">
                <span className="text-sm font-medium">คำอธิบายรูป (ไม่บังคับ — ใช้เป็นคำบรรยายและสำหรับโปรแกรมอ่านหน้าจอ)</span>
                <input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={150} className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3" />
              </label>
              <button type="button" onClick={addImage} disabled={busy} className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white disabled:opacity-50">{busy ? "กำลังอัปโหลด…" : "แทรกรูปนี้"}</button>
            </>
          ) : (
            <p className="text-sm text-neutral-700">ขณะนี้ปิดการอัปโหลดรูปเข้าเซิร์ฟเวอร์ — ให้เก็บรูปไว้ใน Google Drive แล้วใช้ปุ่ม “แทรกลิงก์ Drive / PDF” แทน (แอดมินเปิดการอัปโหลดได้ที่ ตั้งค่าเขตพื้นที่)</p>
          )}
          {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
        </div>
      )}

      {panel === "drive" && (
        <div className="space-y-3 rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
          <p className="text-sm text-neutral-700">
            <strong>PDF แนะนำให้ใช้ลิงก์ Google Drive:</strong> อัปโหลดไฟล์ไว้ใน Drive แล้วแชร์เป็น “ทุกคนที่มีลิงก์ (ผู้ดู)” จากนั้นวางลิงก์ที่นี่ ระบบจะเก็บภาพตัวอย่างหน้าแรกขนาดเล็กไว้ และผู้ชมกดเปิดแบบเต็มจอได้ (ไฟล์ PDF จริงยังอยู่ใน Drive จึงไม่หนักเว็บ)
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-medium">ลิงก์ไฟล์ใน Google Drive *</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" autoCapitalize="none" placeholder="https://drive.google.com/file/d/…/view" className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">ชื่อที่แสดงใต้ภาพ (ไม่บังคับ)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3" />
          </label>
          <button type="button" onClick={addDrive} disabled={busy} className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white disabled:opacity-50">{busy ? "กำลังดึงภาพตัวอย่าง…" : "ดึงภาพตัวอย่างและแทรก"}</button>
          {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
        </div>
      )}

      {/* the text always stays in the form (hidden while previewing) so it is saved either way */}
      <textarea
        ref={area}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required={required}
        rows={rows}
        maxLength={maxLength}
        aria-label={ariaLabel}
        className={`w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm leading-relaxed ${preview ? "hidden" : ""}`}
      />
      {preview && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <SitePageBody body={value} allowHtml={allowHtml} />
        </div>
      )}
    </div>
  );
}
