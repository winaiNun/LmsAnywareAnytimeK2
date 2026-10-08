"use client";

import { useRef, useState } from "react";
import { requestVideoUpload } from "./actions";

const MAX_BYTES = 30 * 1024 * 1024;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number; name: string }
  | { kind: "done"; name: string; size: number; direct: boolean }
  | { kind: "error"; message: string };

/**
 * Hero video picker. With an S3/R2 driver the file goes straight from the browser to the bucket
 * (no server body-size limit, shows progress) and only its key is submitted with the form.
 * With the local driver the file is attached to the form and posted as before.
 */
export default function VideoField({ currentUrl, onBusyChange }: { currentUrl: string | null; onBusyChange: (busy: boolean) => void }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [key, setKey] = useState("");
  const chooserRef = useRef<HTMLInputElement>(null);
  const formFileRef = useRef<HTMLInputElement>(null); // carries the file for the non-direct (local) path

  function reset() {
    setKey("");
    setStatus({ kind: "idle" });
    if (chooserRef.current) chooserRef.current.value = "";
    if (formFileRef.current) formFileRef.current.value = "";
  }

  async function onChoose(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setStatus({ kind: "error", message: `ไฟล์ใหญ่ ${mb(file.size)} เกิน 30 MB กรุณาบีบอัดวิดีโอก่อน` });
      if (chooserRef.current) chooserRef.current.value = "";
      return;
    }

    onBusyChange(true);
    try {
      const target = await requestVideoUpload(file.type, file.size);
      if ("error" in target) {
        setStatus({ kind: "error", message: target.error });
        if (chooserRef.current) chooserRef.current.value = "";
        return;
      }

      if (!target.direct) {
        // local driver: let the form submit the file itself
        const dt = new DataTransfer();
        dt.items.add(file);
        if (formFileRef.current) formFileRef.current.files = dt.files;
        setStatus({ kind: "done", name: file.name, size: file.size, direct: false });
        return;
      }

      setStatus({ kind: "uploading", percent: 0, name: file.name });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", target.url);
        xhr.setRequestHeader("Content-Type", target.contentType);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setStatus({ kind: "uploading", percent: Math.round((e.loaded / e.total) * 100), name: file.name });
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`ที่เก็บไฟล์ตอบกลับ ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("เชื่อมต่อที่เก็บไฟล์ไม่ได้ (ตรวจสอบ CORS ของ bucket)"));
        xhr.send(file);
      });
      setKey(target.key);
      setStatus({ kind: "done", name: file.name, size: file.size, direct: true });
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ" });
      if (chooserRef.current) chooserRef.current.value = "";
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">วิดีโอพื้นหลัง (MP4/WebM ไม่เกิน 30 MB, ไม่มีเสียงจะดีที่สุด)</legend>

      {/* real form fields: only one of these is used, depending on the storage driver */}
      <input type="hidden" name="heroVideoKeyUploaded" value={key} />
      <input ref={formFileRef} type="file" name="video" className="hidden" tabIndex={-1} aria-hidden />

      <input
        ref={chooserRef}
        type="file"
        accept="video/mp4,video/webm"
        aria-label="เลือกไฟล์วิดีโอพื้นหลัง"
        className="block w-full text-sm"
        onChange={(e) => onChoose(e.target.files?.[0])}
      />

      {status.kind === "uploading" && (
        <div role="status" className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${status.percent}%` }} />
          </div>
          <p className="text-xs text-neutral-600">กำลังอัปโหลด {status.name} … {status.percent}%</p>
        </div>
      )}
      {status.kind === "done" && (
        <p role="status" className="text-xs text-green-700">
          {status.direct ? "อัปโหลดเข้าที่เก็บไฟล์แล้ว" : "พร้อมอัปโหลดเมื่อกดบันทึก"}: {status.name} ({mb(status.size)}) — กด “บันทึก” เพื่อใช้วิดีโอนี้{" "}
          <button type="button" onClick={reset} className="underline">ยกเลิก</button>
        </p>
      )}
      {status.kind === "error" && <p role="alert" className="text-xs text-red-600">{status.message}</p>}

      {currentUrl && (
        <div className="flex items-center gap-4">
          <video src={currentUrl} muted className="h-16 rounded-lg border border-neutral-200" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="removeVideo" /> ลบวิดีโอปัจจุบัน</label>
        </div>
      )}
    </fieldset>
  );
}
