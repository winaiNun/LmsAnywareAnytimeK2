"use client";

import { useEffect, useState } from "react";
import CropImageField from "@/components/admin/crop-image-field";
import { driveThumbnailUrl, parseDriveFileId } from "@/lib/drive";

export type CoverValue = { mode: "keep" | "none" | "drive" | "upload"; link?: string; fx: number; fy: number };

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

/**
 * 16:9 cover picture, two ways in (like every image in the system): a public Google Drive link with a focus point, or
 * upload + crop (only while the admin allows uploads to our server). The cropped file travels in the surrounding
 * <form> as the field `cover`; the rest is reported through `onChange`.
 */
export default function CoverField({ currentUrl, currentDrive, fx: fx0, fy: fy0, allowUpload, onChange, emptyText = "ยังไม่มีภาพปก" }: {
  currentUrl: string | null;
  currentDrive: string;
  fx: number;
  fy: number;
  allowUpload: boolean;
  onChange: (v: CoverValue) => void;
  emptyText?: string;
}) {
  const [mode, setMode] = useState<CoverValue["mode"]>("keep");
  const [link, setLink] = useState(currentDrive);
  const [fx, setFx] = useState(fx0);
  const [fy, setFy] = useState(fy0);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => { onChange({ mode, link: mode === "drive" ? link : undefined, fx, fy }); }, [mode, link, fx, fy]); // eslint-disable-line react-hooks/exhaustive-deps

  const driveId = parseDriveFileId(link);
  const shown = mode === "upload" ? preview : mode === "drive" ? (driveId ? driveThumbnailUrl(driveId, 640) : null) : mode === "keep" ? currentUrl : null;
  const options: [CoverValue["mode"], string][] = [["keep", currentUrl ? "ใช้ภาพเดิม" : "ยังไม่มี"], ["drive", "ลิงก์ Google Drive"], ...(allowUpload ? ([["upload", "อัปโหลด/ครอป"]] as [CoverValue["mode"], string][]) : []), ["none", "ไม่มีปก"]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ที่มาของภาพปก">
        {options.map(([m, text]) => (
          <label key={m} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm ${mode === m ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>
            <input type="radio" name="coverMode" checked={mode === m} onChange={() => setMode(m)} className="sr-only" />{text}
          </label>
        ))}
      </div>
      {mode === "drive" && (
        <div className="space-y-3">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/file/d/…/view" className={input} aria-label="ลิงก์ภาพปกจาก Google Drive" />
          <p className="text-xs text-neutral-500">ภาพ 16:9 ขนาด <strong>1280 × 720 px</strong> (อย่างน้อย 640 × 360) ไฟล์ JPG/PNG ไม่เกิน 2 MB · แชร์เป็น “ทุกคนที่มีลิงก์” · ทำภาพ 16:9 ได้ใน Canva (กำหนดขนาดเอง 1280 × 720)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-sm">ซ้าย–ขวา <input type="range" min={0} max={1} step={0.01} value={fx} onChange={(e) => setFx(+e.target.value)} className="flex-1" /></label>
            <label className="flex items-center gap-3 text-sm">บน–ล่าง <input type="range" min={0} max={1} step={0.01} value={fy} onChange={(e) => setFy(+e.target.value)} className="flex-1" /></label>
          </div>
        </div>
      )}
      {mode === "upload" && <CropImageField name="cover" label="เลือกภาพและครอป 16:9" aspects={[{ label: "16:9", value: 16 / 9 }]} maxWidth={960} recommendedWidth={1280} minWidth={640} onPreview={setPreview} />}
      <div className="aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="ตัวอย่างภาพปก" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={{ objectPosition: `${fx * 100}% ${fy * 100}%` }} />
        ) : (
          <p className="flex h-full items-center justify-center p-4 text-center text-sm text-neutral-500">{emptyText}</p>
        )}
      </div>
    </div>
  );
}
