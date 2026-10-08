"use client";

import { useState } from "react";
import { Icon, Spinner } from "@/components/icons";
import { fetchDriveThumbnail } from "./drive-actions";

const kb = (n: number) => `${Math.round(n / 1024)} KB`;

/**
 * "Image from Google Drive": paste a public link, the server fetches Drive's thumbnail, and it opens in
 * the same crop dialog as an uploaded file. Only the cropped, compressed WebP is stored.
 */
export default function DrivePicker({ onFile }: { onFile: (file: File, viewUrl: string) => void }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function load() {
    setError("");
    setInfo("");
    if (!link.trim()) {
      setError("วางลิงก์ไฟล์จาก Google Drive ก่อน");
      return;
    }
    setBusy(true);
    try {
      const r = await fetchDriveThumbnail(link);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const blob = await (await fetch(r.dataUrl)).blob();
      const ext = r.mime === "image/png" ? "png" : r.mime === "image/webp" ? "webp" : "jpg";
      const file = new File([blob], `drive-${r.id}.${ext}`, { type: r.mime });
      setInfo(`ดึงภาพตัวอย่างจาก Drive แล้ว (${r.width}×${r.height} px, ${kb(r.bytes)}) — ครอบภาพในหน้าต่างที่เปิดขึ้น`);
      onFile(file, r.viewUrl);
    } catch {
      setError("ดึงภาพไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path d="M8.2 3h7.6l6.2 10.7h-7.6z" fill="#FBBC04" /><path d="M2 13.7 8.2 3l3.8 6.6L5.8 20.3z" fill="#0F9D58" /><path d="M5.8 20.3 12 9.6l3.8 6.6-2 4.1z" fill="none" /><path d="M5.8 20.3h12.4L22 13.7h-12.4z" fill="#4285F4" />
        </svg>
        หรือใช้ลิงก์สาธารณะจาก Google Drive (ไฟล์ภาพหรือ PDF)
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); load(); } }}
          placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
          aria-label="ลิงก์ Google Drive"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm"
        />
        <button type="button" onClick={load} disabled={busy} className="flex min-h-11 items-center gap-2 rounded-lg border border-brand bg-brand-soft px-4 text-sm font-semibold text-brand hover:bg-white disabled:opacity-60">
          {busy ? <Spinner className="h-4 w-4" /> : <Icon name="arrowRight" className="h-4 w-4" />}
          {busy ? "กำลังดึงภาพ…" : "ดึงภาพจาก Drive"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        ใน Drive กด “แชร์” แล้วตั้งเป็น “ทุกคนที่มีลิงก์” (ผู้ดู) · PDF จะใช้หน้าแรกเป็นภาพ · ระบบดึงภาพตัวอย่างความละเอียดพอดี ครอบ และบีบเป็นไฟล์เล็กเก็บไว้เอง
        (แก้ไฟล์ใน Drive ภายหลัง ภาพบนเว็บจะไม่เปลี่ยนตาม ต้องดึงใหม่)
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {info && <p role="status" className="text-sm text-green-700">{info}</p>}
    </div>
  );
}
