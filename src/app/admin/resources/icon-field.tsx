"use client";

import { useRef, useState } from "react";
import ResourceIcon from "@/components/resource-icon";
import { Spinner } from "@/components/icons";
import { ICON_OUT, MAX_ZOOM, avatarBox, clampCenter, type AvatarData } from "@/lib/avatar";
import { fetchResourceIconFromDrive } from "./actions";

type Source = { kind: "upload"; src: string; w: number; h: number; file: File } | { kind: "drive"; src: string; w: number; h: number; link: string };
type Pick = { mode: "upload"; previewUrl: string } | { mode: "drive"; link: string; cx: number; cy: number; zoom: number; aspect: number; previewUrl: string } | { mode: "remove" } | null;

/**
 * The picture of an outside source (instead of the line icon). Two ways in, like the other image fields: upload + crop
 * (only while the admin allows server uploads) or a public Google Drive link (nothing stored here but the link and the crop).
 * Both open the same square cropper (drag to move, slide to zoom). The result travels with the form as hidden fields.
 */
export default function IconField({ current, allowUpload, icon, color }: { current: AvatarData | null; allowUpload: boolean; icon: string; color: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const [tab, setTab] = useState<"upload" | "drive">(allowUpload ? "upload" : "drive");
  const [link, setLink] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [crop, setCrop] = useState({ cx: 0.5, cy: 0.5, zoom: 1 });
  const [picked, setPicked] = useState<Pick>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const aspect = source ? source.w / source.h : 1;
  const showing: AvatarData | null = picked?.mode === "remove" ? null : picked ? { url: picked.mode === "upload" ? picked.previewUrl : null, driveId: null, cx: 0.5, cy: 0.5, zoom: 1, aspect: 1 } : current;

  function openCropper(s: Source) {
    setSource(s);
    setCrop({ cx: 0.5, cy: 0.5, zoom: 1 });
    setError("");
    dialog.current?.showModal();
  }
  function closeCropper() {
    dialog.current?.close();
    if (source?.kind === "upload") URL.revokeObjectURL(source.src);
    setSource(null);
  }
  function pickFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.size > 2 * 1024 * 1024) return setError("ไฟล์ใหญ่เกินไป (ไม่เกิน 2 MB)");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => openCropper({ kind: "upload", src: url, w: img.naturalWidth, h: img.naturalHeight, file });
    img.onerror = () => { URL.revokeObjectURL(url); setError("เปิดไฟล์รูปนี้ไม่ได้ กรุณาเลือกไฟล์ PNG, JPG หรือ WebP"); };
    img.src = url;
  }
  async function fetchDrive() {
    setError("");
    if (!link.trim()) return setError("วางลิงก์ไฟล์จาก Google Drive ก่อน");
    setBusy(true);
    try {
      const r = await fetchResourceIconFromDrive(link);
      if (!r.ok) return setError(r.error);
      openCropper({ kind: "drive", src: r.dataUrl, w: r.width, h: r.height, link });
    } catch {
      setError("ดึงภาพไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
  function setZoom(zoom: number) {
    setCrop((c) => ({ zoom, ...clampCenter(c.cx, c.cy, zoom, aspect) }));
  }
  function move(dx: number, dy: number, from: { cx: number; cy: number }) {
    const side = view.current?.clientWidth ?? 1;
    const dw = (aspect >= 1 ? crop.zoom * aspect : crop.zoom) * side;
    const dh = (aspect >= 1 ? crop.zoom : crop.zoom / aspect) * side;
    setCrop((c) => ({ ...c, ...clampCenter(from.cx - dx / dw, from.cy - dy / dh, c.zoom, aspect) }));
  }

  async function confirm() {
    if (!source) return;
    if (source.kind === "drive") {
      setPicked({ mode: "drive", link: source.link, ...crop, aspect, previewUrl: source.src });
      if (fileInput.current) fileInput.current.value = "";
      closeCropper();
      return;
    }
    // upload: render the chosen square to a small WebP and hand it to the form
    const img = new Image();
    img.src = source.src;
    await img.decode();
    const side = Math.min(source.w, source.h) / crop.zoom;
    const out = Math.min(ICON_OUT, Math.round(side));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, crop.cx * source.w - side / 2, crop.cy * source.h - side / 2, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.88));
    if (!blob) return setError("สร้างรูปไม่สำเร็จ");
    const file = new File([blob], "icon.webp", { type: "image/webp" });
    if (fileInput.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.current.files = dt.files;
    }
    setPicked({ mode: "upload", previewUrl: URL.createObjectURL(blob) });
    closeCropper();
  }

  const tabBtn = (t: "upload" | "drive", label: string) => (
    <button type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(""); }} className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold ${tab === t ? "bg-white text-brand shadow" : "text-neutral-600"}`}>{label}</button>
  );

  return (
    <fieldset className="space-y-3 rounded-xl border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-medium">รูปไอคอนของตัวเอง (ไม่บังคับ — ถ้าไม่ใส่จะใช้ไอคอนและสีด้านบน)</legend>

      <input type="hidden" name="iconMode" value={picked?.mode ?? "keep"} />
      <input ref={fileInput} type="file" name="iconFile" accept="image/webp" hidden tabIndex={-1} aria-hidden />
      {picked?.mode === "drive" && (
        <>
          <input type="hidden" name="iconLink" value={picked.link} />
          <input type="hidden" name="iconCx" value={picked.cx} />
          <input type="hidden" name="iconCy" value={picked.cy} />
          <input type="hidden" name="iconZoom" value={picked.zoom} />
          <input type="hidden" name="iconAspect" value={picked.aspect} />
        </>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {picked?.mode === "drive" ? (
          <span className="relative inline-block h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={picked.previewUrl} alt="" className="absolute max-w-none" style={avatarBox({ cx: picked.cx, cy: picked.cy, zoom: picked.zoom, aspect: picked.aspect })} />
          </span>
        ) : (
          <ResourceIcon image={showing} icon={icon} color={color} size={52} />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div role="tablist" className="flex gap-1 rounded-xl bg-neutral-100 p-1">
            {allowUpload && tabBtn("upload", "อัปโหลดรูป")}
            {tabBtn("drive", "ลิงก์ Google Drive")}
          </div>
          {tab === "upload" && allowUpload ? (
            <div className="space-y-1">
              <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="เลือกรูปไอคอน" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} className="block w-full text-sm" />
              <p className="text-xs text-neutral-500">เลือกรูปแล้วครอบเป็นสี่เหลี่ยมจัตุรัส ระบบย่อเหลือ {ICON_OUT}×{ICON_OUT} px · ไม่เกิน 2 MB</p>
            </div>
          ) : (
            <div className="space-y-2">
              {!allowUpload && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">ตอนนี้ใช้ลิงก์ Google Drive เป็นหลัก (ปิดการอัปโหลดรูปเข้าเซิร์ฟเวอร์ไว้ — เปิดได้ที่ตั้งค่าเขตพื้นที่)</p>}
              <div className="flex flex-wrap gap-2">
                <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchDrive(); } }} placeholder="https://drive.google.com/file/d/…/view" aria-label="ลิงก์ Google Drive" className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 text-sm" />
                <button type="button" onClick={fetchDrive} disabled={busy} className="flex min-h-11 items-center gap-2 rounded-lg border border-brand bg-brand-soft px-4 text-sm font-semibold text-brand disabled:opacity-60">{busy && <Spinner className="h-4 w-4" />}{busy ? "กำลังดึงภาพ…" : "ดึงภาพและครอบ"}</button>
              </div>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-neutral-500">
                <li>ภาพสี่เหลี่ยมจัตุรัส 1:1 ขนาด <strong>256 × 256</strong> ถึง 512 × 512 px (โลโก้พื้นโปร่งใสหรือพื้นขาวจะสวยที่สุด) ไฟล์ PNG/JPG ไม่เกิน 1 MB</li>
                <li>ใน Drive ตั้งการแชร์เป็น “ทุกคนที่มีลิงก์” (ผู้ดู) แล้วคัดลอกลิงก์มาวาง · ลบไฟล์หรือเลิกแชร์ รูปจะหายและกลับไปใช้ไอคอน</li>
              </ul>
            </div>
          )}
          {(current || picked) && picked?.mode !== "remove" && (
            <button type="button" onClick={() => { setPicked({ mode: "remove" }); if (fileInput.current) fileInput.current.value = ""; }} className="min-h-10 text-sm text-red-600 underline">เอารูปออก ใช้ไอคอนแทน</button>
          )}
          {picked?.mode === "remove" && <p className="text-sm text-amber-800">จะกลับไปใช้ไอคอนและสี เมื่อกดบันทึก <button type="button" onClick={() => setPicked(null)} className="ml-1 underline">ยกเลิก</button></p>}
          {picked && picked.mode !== "remove" && <p className="text-sm text-green-700">เลือกรูปแล้ว จะใช้เมื่อกดบันทึก <button type="button" onClick={() => { setPicked(null); if (fileInput.current) fileInput.current.value = ""; }} className="ml-1 text-neutral-600 underline">ยกเลิก</button></p>}
          {error && !source && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <dialog ref={dialog} aria-label="ครอบรูปไอคอน" onCancel={closeCropper} className="w-[min(94vw,420px)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/60">
        <div className="space-y-4 p-5">
          <h3 className="text-lg font-bold">ครอบรูปไอคอน</h3>
          <div
            ref={view}
            className="relative mx-auto aspect-square w-full max-w-[320px] cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-neutral-200 ring-2 ring-brand active:cursor-grabbing"
            tabIndex={0}
            aria-label="พื้นที่ครอบรูป ลากเพื่อเลื่อน หรือใช้ปุ่มลูกศร"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx: crop.cx, cy: crop.cy }; }}
            onPointerMove={(e) => { if (drag.current) move(e.clientX - drag.current.x, e.clientY - drag.current.y, drag.current); }}
            onPointerUp={() => (drag.current = null)}
            onKeyDown={(e) => {
              const d: Record<string, [number, number]> = { ArrowLeft: [20, 0], ArrowRight: [-20, 0], ArrowUp: [0, 20], ArrowDown: [0, -20] };
              if (d[e.key]) { e.preventDefault(); move(d[e.key][0], d[e.key][1], crop); }
            }}
          >
            {source && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={source.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={avatarBox({ ...crop, aspect })} />
            )}
          </div>
          {source && (
            <div className="flex items-center justify-center gap-3 text-xs text-neutral-500">
              <span>ตัวอย่างขนาดจริง</span>
              <span className="relative inline-block h-[52px] w-[52px] overflow-hidden rounded-xl bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={source.src} alt="" draggable={false} className="absolute max-w-none" style={avatarBox({ ...crop, aspect })} />
              </span>
              <span>ภาพต้นฉบับ {source.w}×{source.h} px{Math.min(source.w, source.h) < 200 ? " (เล็กไป อาจไม่คม)" : ""}</span>
            </div>
          )}
          <label className="flex items-center gap-3 text-sm">ซูม
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom} onChange={(e) => setZoom(+e.target.value)} className="flex-1" aria-label="ซูมรูป" />
            <span className="w-12 text-right text-neutral-500">{Math.round(crop.zoom * 100)}%</span>
          </label>
          <p className="text-xs text-neutral-500">ลากรูปเพื่อเลือกส่วนที่จะแสดงในกรอบสี่เหลี่ยมจัตุรัส</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCrop({ cx: 0.5, cy: 0.5, zoom: 1 })} className="min-h-11 rounded-lg border border-neutral-300 px-4">รีเซ็ต</button>
            <button type="button" onClick={closeCropper} className="min-h-11 rounded-lg border border-neutral-300 px-4">ยกเลิก</button>
            <button type="button" onClick={confirm} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white">ใช้รูปนี้</button>
          </div>
        </div>
      </dialog>
    </fieldset>
  );
}
