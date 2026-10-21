"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import CropImageField from "@/components/admin/crop-image-field";
import { Spinner } from "@/components/icons";
import { driveThumbnailUrl, parseDriveFileId } from "@/lib/drive";
import { KIND_LABEL, isParsed, parseMediaLink, youtubeThumbUrl, youtubeVideoId } from "@/lib/embed";
import { MAX_HTML_BYTES, MAX_ITEMS } from "@/lib/media-access";
import { saveMedia } from "./actions";

type Option = { id: string; name: string; icon?: string };
export type RowKind = "LINK" | "HTML" | "UPLOAD" | "IMAGE";
export type FormItem = { id?: string; kind: RowKind; label: string; url: string; html: string; existingFile?: string; imageUrl?: string };
export type MediaFormValues = {
  id?: string;
  title: string;
  description: string;
  areaId: string;
  typeId: string;
  levelIds: string[];
  tags: string;
  authorName: string;
  coverUrl: string | null; // what is shown now
  coverDrive: string; // Drive link when the cover is a Drive file
  coverFx: number;
  coverFy: number;
  items: FormItem[];
  status?: string;
  reviewNote?: string | null;
};

type Row = FormItem & { key: string; file?: File; picked?: string | null /* preview of a newly cropped picture */ };
type CoverMode = "keep" | "none" | "drive" | "upload" | "youtube";

// crop ratios offered for a picture item
const PICTURE_ASPECTS = [
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
  { label: "4:3", value: 4 / 3 },
  { label: "A4 แนวตั้ง", value: 210 / 297 },
  { label: "1:1", value: 1 },
];

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";
const kb = (n: number) => `${Math.round(n / 1024)} KB`;
let seq = 0;
const newKey = () => `r${++seq}`;

type Props = {
  values: MediaFormValues;
  areas: Option[];
  types: Option[];
  levels: Option[];
  allowUpload: boolean; // admin switch on + durable storage
  isAdmin: boolean;
  isStudent: boolean;
  /** where to go after a save (the page appends ?saved=<status>) */
  doneHref: string;
};

/** The one form for adding / editing a media item (members at /dashboard/media, admins at /admin/media). */
export default function MediaForm({ values, areas, types, levels, allowUpload, isAdmin, isStudent, doneHref }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const submitMode = useRef(false);
  const [title, setTitle] = useState(values.title);
  const [description, setDescription] = useState(values.description);
  const [areaId, setAreaId] = useState(values.areaId);
  const [typeId, setTypeId] = useState(values.typeId);
  const [levelIds, setLevelIds] = useState(values.levelIds);
  const [tags, setTags] = useState(values.tags);
  const [authorName, setAuthorName] = useState(values.authorName);
  const [rows, setRows] = useState<Row[]>(values.items.length ? values.items.map((i) => ({ ...i, key: newKey() })) : [{ key: newKey(), kind: "LINK", label: "", url: "", html: "" }]);
  const [coverMode, setCoverMode] = useState<CoverMode>("keep");
  const [coverLink, setCoverLink] = useState(values.coverDrive);
  const [fx, setFx] = useState(values.coverFx);
  const [fy, setFy] = useState(values.coverFy);
  const [preview, setPreview] = useState<string | null>(null); // local preview of an uploaded (cropped) cover
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [showHtml, setShowHtml] = useState<string | null>(null);

  const driveId = parseDriveFileId(coverLink);
  // the first YouTube video among the links can lend its thumbnail as the cover
  const ytId = rows.map((r) => (r.kind === "LINK" && r.url.trim() ? (() => { const p = parseMediaLink(r.url); return isParsed(p) && p.kind === "YOUTUBE" ? youtubeVideoId(p.url) : null; })() : null)).find(Boolean) ?? null;
  const shownCover = coverMode === "upload" ? preview : coverMode === "drive" ? (driveId ? driveThumbnailUrl(driveId, 640) : null) : coverMode === "youtube" ? (ytId ? youtubeThumbUrl(ytId) : null) : coverMode === "keep" ? values.coverUrl : null;
  // no cover yet and a YouTube link appears: take its thumbnail (the person can still change it)
  useEffect(() => { if (ytId && coverMode === "keep" && !values.coverUrl) setCoverMode("youtube"); }, [ytId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!ytId && coverMode === "youtube") setCoverMode("keep"); }, [ytId, coverMode]);

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) => setRows((rs) => { const j = i + d; if (j < 0 || j >= rs.length) return rs; const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const add = (kind: RowKind) => setRows((rs) => (rs.length >= MAX_ITEMS ? rs : [...rs, { key: newKey(), kind, label: "", url: "", html: "" }]));

  function submit(wantSubmit: boolean) {
    setError("");
    const fd = new FormData(formRef.current ?? undefined);
    const payloadItems = rows.map((r, i) => ({
      id: r.id, kind: r.kind, label: r.label,
      url: r.kind === "LINK" ? r.url : undefined,
      html: r.kind === "HTML" ? r.html : undefined,
      fileField: r.kind === "UPLOAD" && r.file ? `file_${i}` : r.kind === "IMAGE" && r.picked ? `img_${r.key}` : undefined, // a cropped picture travels in its own hidden field
    }));
    rows.forEach((r, i) => { if (r.kind === "UPLOAD" && r.file) fd.set(`file_${i}`, r.file); });
    fd.set("payload", JSON.stringify({
      title, description, areaId, typeId: typeId || null, levelIds, tags, authorName,
      cover: { mode: coverMode, link: coverMode === "drive" ? coverLink : undefined, fx, fy },
      items: payloadItems, submit: wantSubmit,
    }));
    start(async () => {
      const r = await saveMedia(values.id ?? null, fd);
      if (r.error) { setError(r.error); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      router.push(`${doneHref}${doneHref.includes("?") ? "&" : "?"}saved=${r.status}`);
      router.refresh();
    });
  }

  const label = "block space-y-1";
  const hint = "text-xs text-neutral-500";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => { e.preventDefault(); submit(submitMode.current); }}
      className="space-y-6"
    >
      {values.status === "REJECTED" && values.reviewNote && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800"><strong>ผู้ตรวจส่งกลับให้แก้ไข:</strong> {values.reviewNote}</p>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

      {/* ---------- basics ---------- */}
      <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">ข้อมูลสื่อ</h2>
        <label className={label}><span className="text-sm font-medium">ชื่อสื่อ *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={120} className={input} placeholder="เช่น เกมฝึกบวกเลข ป.1" />
        </label>
        <label className={label}><span className="text-sm font-medium">คำอธิบาย</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} className={`${input} py-2`} placeholder="สื่อนี้เหมาะกับใคร ใช้อย่างไร เรียนรู้อะไร" />
          <span className={hint}>{description.length}/2000</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}><span className="text-sm font-medium">กลุ่มสาระ *</span>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} required className={input}>
              <option value="" disabled>— เลือกกลุ่มสาระ —</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className={label}><span className="text-sm font-medium">ประเภทสื่อ</span>
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={input}>
              <option value="">— ไม่ระบุ —</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">ระดับชั้น / กลุ่มผู้ใช้ (เลือกได้หลายข้อ)</legend>
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => {
              const on = levelIds.includes(l.id);
              return (
                <label key={l.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm ${on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>
                  <input type="checkbox" checked={on} onChange={() => setLevelIds((v) => (on ? v.filter((x) => x !== l.id) : [...v, l.id]))} className="sr-only" />
                  {on ? "✓ " : ""}{l.name}
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className={label}><span className="text-sm font-medium">แท็ก (คั่นด้วยจุลภาค ไม่เกิน 8 คำ)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} maxLength={400} className={input} placeholder="เช่น การบวก, เกม, ป.1" />
        </label>
        {isAdmin && (
          <label className={label}><span className="text-sm font-medium">ชื่อผู้จัดทำ (กรอกเมื่อลงสื่อแทนผู้อื่น — ว่าง = ใช้ชื่อของคุณ)</span>
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} maxLength={100} className={input} />
          </label>
        )}
      </section>

      {/* ---------- items ---------- */}
      <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-semibold">สื่อที่ให้เปิด/ดาวน์โหลด *</h2>
          <p className={hint}>รายการแรกจะแสดงในหน้าเว็บเลย รายการอื่นเป็นไฟล์แนบ (ไม่เกิน {MAX_ITEMS} รายการ)</p>
        </div>
        <ul className="space-y-4">
          {rows.map((r, i) => {
            const parsed = r.kind === "LINK" && r.url.trim() ? parseMediaLink(r.url) : null;
            const htmlBytes = new TextEncoder().encode(r.html).length;
            return (
              <li key={r.key} className="space-y-3 rounded-xl border border-neutral-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{i + 1}. {r.kind === "LINK" ? "ลิงก์" : r.kind === "HTML" ? "แอปพลิเคชัน HTML" : r.kind === "IMAGE" ? "รูปภาพ" : "ไฟล์อัปโหลด"}</span>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="เลื่อนขึ้น" className="min-h-9 min-w-9 rounded-lg border border-neutral-300 disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="เลื่อนลง" className="min-h-9 min-w-9 rounded-lg border border-neutral-300 disabled:opacity-30">↓</button>
                    <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} disabled={rows.length === 1} className="min-h-9 rounded-lg border border-red-200 px-3 text-sm text-red-600 disabled:opacity-30">ลบ</button>
                  </span>
                </div>

                {r.kind === "LINK" && (
                  <div className="space-y-2">
                    <input value={r.url} onChange={(e) => patch(r.key, { url: e.target.value })} placeholder="วางลิงก์ YouTube / Google Drive / Docs / Canva / เว็บอื่น" inputMode="url" autoCapitalize="none" className={input} />
                    {parsed && (isParsed(parsed)
                      ? <p className="text-xs text-green-700">✓ {KIND_LABEL[parsed.kind]} ({parsed.provider}) — {parsed.embedUrl ? "จะแสดงในหน้าเว็บ" : "จะเปิดในแท็บใหม่"}</p>
                      : <p role="alert" className="text-xs text-red-600">✕ {parsed.error}</p>)}
                  </div>
                )}

                {r.kind === "HTML" && (
                  <div className="space-y-2">
                    <textarea value={r.html} onChange={(e) => patch(r.key, { html: e.target.value })} rows={8} spellCheck={false} placeholder="วางโค้ด HTML ทั้งหน้า (รวม CSS/JavaScript ได้)" className={`${input} py-2 font-mono text-xs`} />
                    <p className={`text-xs ${htmlBytes > MAX_HTML_BYTES ? "text-red-600" : "text-neutral-500"}`}>{kb(htmlBytes)} / {kb(MAX_HTML_BYTES)} — รันในกล่องทดสอบที่แยกจากระบบ (อ่านบัญชีผู้ใช้ไม่ได้)</p>
                    <button type="button" onClick={() => setShowHtml(showHtml === r.key ? null : r.key)} className="min-h-10 rounded-lg border border-neutral-300 px-4 text-sm">{showHtml === r.key ? "ซ่อนตัวอย่าง" : "ดูตัวอย่าง"}</button>
                    {showHtml === r.key && r.html.trim() && (
                      <iframe title="ตัวอย่าง HTML" srcDoc={r.html} sandbox="allow-scripts" className="aspect-video w-full rounded-lg border border-neutral-300 bg-white" />
                    )}
                  </div>
                )}

                {r.kind === "IMAGE" && (
                  <div className="space-y-2">
                    {(r.picked ?? r.imageUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(r.picked ?? r.imageUrl)!} alt="รูปภาพที่เลือก" className="max-h-72 w-auto max-w-full rounded-lg border border-neutral-200" />
                    )}
                    <CropImageField name={`img_${r.key}`} label={r.picked || r.imageUrl ? "เปลี่ยนรูปภาพ (เลือกแล้วครอป)" : "เลือกรูปภาพและครอป"} aspects={PICTURE_ASPECTS} maxWidth={1280} onPreview={(u) => patch(r.key, { picked: u })} />
                    <p className={hint}>เลือกสัดส่วนได้ตอนครอป: 16:9, 9:16, 4:3, A4, 1:1 — ระบบย่อเป็น WebP ให้เล็กอัตโนมัติ</p>
                  </div>
                )}

                {r.kind === "UPLOAD" && (
                  <div className="space-y-1">
                    {r.existingFile && !r.file && <p className="text-sm text-neutral-600">ไฟล์ปัจจุบัน: {r.label || r.existingFile} (เลือกไฟล์ใหม่เพื่อแทนที่)</p>}
                    <input type="file" accept=".pdf,.epub,.docx,.pptx,.xlsx,.zip,.mp3" onChange={(e) => patch(r.key, { file: e.target.files?.[0], label: r.label || e.target.files?.[0]?.name || "" })} className="block w-full text-sm" />
                    <p className={hint}>PDF, ePub, Word, PowerPoint, Excel, ZIP, MP3 ไม่เกิน 4 MB (ไฟล์ใหญ่กว่านี้ใช้ลิงก์ Google Drive)</p>
                  </div>
                )}

                <label className={label}><span className="text-xs font-medium text-neutral-600">ชื่อที่แสดง (ไม่บังคับ)</span>
                  <input value={r.label} onChange={(e) => patch(r.key, { label: e.target.value })} maxLength={80} className={input} />
                </label>
              </li>
            );
          })}
        </ul>
        {rows.length < MAX_ITEMS && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => add("LINK")} className="min-h-11 rounded-lg border border-brand bg-brand-soft px-4 text-sm font-semibold text-brand">+ ลิงก์</button>
            {!isStudent && <button type="button" onClick={() => add("HTML")} className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm font-semibold">+ แอป HTML</button>}
            {!isStudent && allowUpload && <button type="button" onClick={() => add("IMAGE")} className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm font-semibold">+ รูปภาพ</button>}
          </div>
        )}
        <div className="rounded-xl bg-brand-soft/60 p-4 text-sm text-neutral-700">
          <p className="font-semibold text-neutral-900">วิธีแชร์ให้คนเปิดได้</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li><strong>Google Drive / Docs / Slides:</strong> กด “แชร์” → ตั้งเป็น <strong>“ทุกคนที่มีลิงก์” (ผู้ดู)</strong> แล้วคัดลอกลิงก์มาวาง</li>
            <li><strong>YouTube:</strong> วางลิงก์วิดีโอหรือเพลย์ลิสต์ได้เลย (วิดีโอต้องไม่ตั้งเป็นส่วนตัว)</li>
            <li><strong>Google Apps Script:</strong> Deploy เป็น “เว็บแอป” (ผู้เข้าถึง: ทุกคน) แล้ววางลิงก์ที่ลงท้าย <code>/exec</code></li>
            {!isStudent && <li><strong>แอป HTML:</strong> วางโค้ดทั้งหน้าในช่อง “+ แอป HTML” ระบบจะรันในกล่องแยกให้ปลอดภัย</li>}
          </ul>
        </div>
      </section>

      {/* ---------- cover ---------- */}
      <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">ภาพปก</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ที่มาของภาพปก">
          {([["keep", values.coverUrl ? "ใช้ภาพเดิม" : "ยังไม่มี"], ["drive", "ลิงก์ Google Drive"], ...(ytId ? [["youtube", "ภาพจาก YouTube"]] : []), ...(allowUpload && !isStudent ? [["upload", "อัปโหลด/ครอป"]] : []), ["none", "ไม่มีปก"]] as [CoverMode, string][]).map(([m, text]) => (
            <label key={m} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm ${coverMode === m ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>
              <input type="radio" name="coverMode" checked={coverMode === m} onChange={() => setCoverMode(m)} className="sr-only" />{text}
            </label>
          ))}
        </div>
        {coverMode === "youtube" && <p className={hint}>ใช้ภาพตัวอย่างของวิดีโอ YouTube ที่ใส่ไว้ (ไม่ต้องอัปโหลด) — เปลี่ยนวิดีโอแล้วภาพปกเปลี่ยนตาม</p>}
        {coverMode === "drive" && (
          <div className="space-y-3">
            <input value={coverLink} onChange={(e) => setCoverLink(e.target.value)} placeholder="https://drive.google.com/file/d/…/view" className={input} aria-label="ลิงก์ภาพปกจาก Google Drive" />
            <p className={hint}>ภาพ 16:9 ขนาด <strong>1280 × 720 px</strong> (อย่างน้อย 640 × 360) ไฟล์ JPG/PNG ไม่เกิน 2 MB · แชร์เป็น “ทุกคนที่มีลิงก์” · ทำภาพ 16:9 ได้ใน Canva (ขนาดกำหนดเอง 1280 × 720)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-3 text-sm">ซ้าย–ขวา <input type="range" min={0} max={1} step={0.01} value={fx} onChange={(e) => setFx(+e.target.value)} className="flex-1" /></label>
              <label className="flex items-center gap-3 text-sm">บน–ล่าง <input type="range" min={0} max={1} step={0.01} value={fy} onChange={(e) => setFy(+e.target.value)} className="flex-1" /></label>
            </div>
          </div>
        )}
        {coverMode === "upload" && (
          <CropImageField name="cover" label="เลือกภาพและครอป 16:9" aspects={[{ label: "16:9", value: 16 / 9 }]} maxWidth={960} recommendedWidth={1280} minWidth={640} onPreview={setPreview} />
        )}
        <div className="aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
          {shownCover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownCover} alt="ตัวอย่างภาพปก" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={{ objectPosition: `${fx * 100}% ${fy * 100}%` }} />
          ) : (
            <p className="flex h-full items-center justify-center p-4 text-center text-sm text-neutral-500">ไม่มีภาพปก — ระบบใช้สีของกลุ่มสาระแทน</p>
          )}
        </div>
      </section>

      {/* ---------- actions ---------- */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <button type="submit" onClick={() => { submitMode.current = true; }} disabled={pending} className="flex min-h-12 items-center gap-2 rounded-xl bg-brand px-7 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          {pending && <Spinner className="h-4 w-4" />}{isAdmin ? "เผยแพร่" : "ส่งขออนุมัติ"}
        </button>
        <button type="submit" onClick={() => { submitMode.current = false; }} disabled={pending} className="min-h-12 rounded-xl border border-neutral-300 bg-white px-6 font-semibold disabled:opacity-60">
          {isAdmin && values.status === "PUBLISHED" ? "บันทึก" : "บันทึกร่าง"}
        </button>
        {!isAdmin && <p className="text-xs text-neutral-500">สื่อจะแสดงบนเว็บหลังผู้ตรวจอนุมัติ{values.status === "PUBLISHED" ? " (การแก้ไขสื่อที่เผยแพร่แล้วต้องได้รับอนุมัติใหม่)" : ""}</p>}
      </div>
    </form>
  );
}
