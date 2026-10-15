"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Aspect = { label: string; value: number };

type Props = {
  /** Name of the (hidden) file input that carries the cropped image to the server action. */
  name: string;
  label: string;
  aspects: Aspect[];
  currentUrl?: string | null;
  maxWidth?: number; // output width cap (px) — keeps files small
  recommendedWidth?: number; // shown as guidance (source image width)
  minWidth?: number; // below this the admin gets a "too small" warning
  safeZone?: boolean; // draw a dashed "keep important text inside" frame in the crop view
  onPreview?: (url: string | null) => void;
  /** Fired when the user picks a local file (as opposed to one handed in through handleRef). */
  onLocalChoose?: () => void;
  /** Lets a parent open the crop dialog with a file it obtained elsewhere (e.g. a Drive thumbnail). */
  handleRef?: React.MutableRefObject<CropHandle | null>;
  /**
   * Accept GIFs. They skip the crop dialog (a canvas would freeze the animation) and are posted
   * as-is; the server converts them to a smaller animated WebP.
   */
  allowGif?: boolean;
  maxGifBytes?: number;
};

export type CropHandle = { openFile: (file: File) => void };

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/**
 * Choose an image, then crop it in a modal: drag to position, slide to zoom, pick an aspect
 * ratio. The result is drawn on a canvas at a capped width and re-encoded as WebP, so only a
 * small standard file is uploaded (the server re-validates and re-encodes it anyway).
 */
export default function CropImageField({ name, label, aspects, currentUrl, maxWidth = 1920, recommendedWidth, minWidth, safeZone = false, onPreview, onLocalChoose, handleRef, allowGif = false, maxGifBytes = 4 * 1024 * 1024 }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const chooserRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLInputElement>(null);

  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState(aspects[0]);
  const [zoom, setZoom] = useState(1);
  const [showSafe, setShowSafe] = useState(true);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [result, setResult] = useState<{ url: string; info: string } | null>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const baseScale = natural.w && view.w ? Math.max(view.w / natural.w, view.h / natural.h) : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback(
    (x: number, y: number, s: number) => ({
      x: Math.min(0, Math.max(view.w - natural.w * s, x)),
      y: Math.min(0, Math.max(view.h - natural.h * s, y)),
    }),
    [view, natural],
  );

  // Fit the image (centred, "cover") whenever the viewport, image or ratio changes.
  const recenter = useCallback(() => {
    if (!natural.w || !view.w) return;
    const s = Math.max(view.w / natural.w, view.h / natural.h);
    setZoom(1);
    setOff({ x: (view.w - natural.w * s) / 2, y: (view.h - natural.h * s) / 2 });
  }, [natural, view]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el || !src) return;
    const measure = () => setView({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [src, aspect]);

  useEffect(recenter, [recenter]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  function open(file: File) {
    if (src) URL.revokeObjectURL(src);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setSrc(url);
      setAspect(aspects[0]);
      dialogRef.current?.showModal();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert("เปิดไฟล์รูปนี้ไม่ได้ กรุณาเลือกไฟล์ PNG, JPG หรือ WebP");
    };
    img.src = url;
  }

  function acceptGif(file: File) {
    if (file.size > maxGifBytes) {
      alert(`ไฟล์ GIF ใหญ่ ${kb(file.size)} เกิน ${kb(maxGifBytes)} กรุณาบีบอัดก่อน (เช่น ลดขนาดภาพ/ความยาว/จำนวนสี) หรือใช้วิดีโอ MP4 แทน`);
      if (chooserRef.current) chooserRef.current.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dt = new DataTransfer();
      dt.items.add(file);
      if (resultRef.current) resultRef.current.files = dt.files;
      if (result) URL.revokeObjectURL(result.url);
      setResult({ url, info: `GIF ${img.naturalWidth}×${img.naturalHeight} px · ${kb(file.size)} — ไม่ครอบ เพื่อให้ยังเคลื่อนไหว ระบบจะแปลงเป็น WebP เคลื่อนไหวให้ตอนบันทึก` });
      onPreview?.(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert("เปิดไฟล์ GIF นี้ไม่ได้");
      if (chooserRef.current) chooserRef.current.value = "";
    };
    img.src = url;
  }

  useEffect(() => {
    if (handleRef) handleRef.current = { openFile: open };
  });

  function changeZoom(z: number) {
    // zoom around the viewport centre
    const cx = (view.w / 2 - off.x) / scale;
    const cy = (view.h / 2 - off.y) / scale;
    const s = baseScale * z;
    setZoom(z);
    setOff(clamp(view.w / 2 - cx * s, view.h / 2 - cy * s, s));
  }

  async function confirm() {
    if (!src) return;
    const img = new Image();
    img.src = src;
    await img.decode();

    const sw = view.w / scale;
    const sh = view.h / scale;
    const sx = -off.x / scale;
    const sy = -off.y / scale;
    const outW = Math.min(maxWidth, Math.round(sw));
    const outH = Math.round(outW / aspect.value);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.82));
    if (!blob) return;
    const file = new File([blob], "image.webp", { type: blob.type });
    const dt = new DataTransfer();
    dt.items.add(file);
    if (resultRef.current) resultRef.current.files = dt.files;

    if (result) URL.revokeObjectURL(result.url);
    const url = URL.createObjectURL(blob);
    setResult({ url, info: `${outW}×${outH} px · ${kb(blob.size)}` });
    onPreview?.(url);
    dialogRef.current?.close();
  }

  function cancel() {
    dialogRef.current?.close();
    if (chooserRef.current) chooserRef.current.value = "";
  }

  function clear() {
    if (resultRef.current) resultRef.current.value = "";
    if (chooserRef.current) chooserRef.current.value = "";
    setResult(null);
    onPreview?.(null);
  }

  const shown = result?.url ?? currentUrl ?? null;

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {/* hidden input that actually carries the cropped file; the chooser below has no name */}
      <input ref={resultRef} type="file" name={name} className="hidden" tabIndex={-1} aria-hidden />

      <div className="flex flex-wrap items-center gap-3">
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="ตัวอย่างรูป" className="h-20 w-36 rounded-lg border border-neutral-200 object-cover" />
        )}
        <div className="space-y-1">
          <input
            ref={chooserRef}
            type="file"
            accept={allowGif ? "image/png,image/jpeg,image/webp,image/gif" : "image/png,image/jpeg,image/webp"}
            aria-label={`${label} — เลือกไฟล์`}
            className="block text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onLocalChoose?.();
                if (allowGif && f.type === "image/gif") acceptGif(f);
                else open(f);
              }
            }}
          />
          {result ? (
            <p className="text-xs text-green-700">
              {result.info.startsWith("GIF") ? "เลือกแล้ว" : "ครอบแล้ว"}: {result.info}{result.info.startsWith("GIF") ? "" : " (WebP)"}{" "}
              <button type="button" onClick={clear} className="underline">ยกเลิกรูปใหม่</button>
            </p>
          ) : (
            <p className="text-xs text-neutral-500">เลือกรูปแล้วจะเปิดหน้าต่างครอบรูป และย่อเป็น WebP ไม่เกิน {maxWidth}px อัตโนมัติ{recommendedWidth ? ` (แนะนำภาพต้นฉบับกว้างอย่างน้อย ${minWidth ?? recommendedWidth} px)` : ""}</p>
          )}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-label="ครอบรูป"
        onCancel={cancel}
        className="w-[min(92vw,720px)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/50"
      >
        <div className="space-y-4 p-5">
          <h3 className="text-lg font-bold">ครอบรูป</h3>

          {aspects.length > 1 && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="สัดส่วนภาพ">
              {aspects.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  role="radio"
                  aria-checked={aspect.label === a.label}
                  onClick={() => setAspect(a)}
                  className={`min-h-10 rounded-lg border px-4 text-sm ${aspect.label === a.label ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          <div
            ref={viewRef}
            className="relative w-full cursor-grab touch-none overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 active:cursor-grabbing"
            style={{ aspectRatio: String(aspect.value) }}
            tabIndex={0}
            aria-label="พื้นที่ครอบรูป ลากเพื่อเลื่อน หรือใช้ปุ่มลูกศร"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setOff(clamp(drag.current.ox + e.clientX - drag.current.px, drag.current.oy + e.clientY - drag.current.py, scale));
            }}
            onPointerUp={() => (drag.current = null)}
            onKeyDown={(e) => {
              const step = 20;
              const d: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
              if (d[e.key]) {
                e.preventDefault();
                setOff(clamp(off.x + d[e.key][0], off.y + d[e.key][1], scale));
              }
            }}
          >
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
                style={{ width: natural.w * scale, height: natural.h * scale, transform: `translate(${off.x}px, ${off.y}px)` }}
              />
            )}
            {safeZone && showSafe && (
              <div className="pointer-events-none absolute inset-[6%] rounded border-2 border-dashed border-amber-300/90">
                <span className="absolute -top-0.5 left-1 -translate-y-full rounded bg-amber-300 px-1.5 text-[10px] font-semibold text-neutral-900">พื้นที่ปลอดภัย</span>
              </div>
            )}
            {/* rule-of-thirds guide */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
              {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/70" />)}
            </div>
          </div>

          {(recommendedWidth || natural.w > 0) && (
            <div className="space-y-1 text-xs">
              <p className="text-neutral-600">ภาพต้นฉบับ {natural.w}×{natural.h} px{recommendedWidth ? ` · ขนาดที่แนะนำกว้าง ${recommendedWidth} px` : ""}</p>
              {minWidth && natural.w > 0 && natural.w < minWidth && (
                <p role="alert" className="rounded bg-amber-50 px-2 py-1 text-amber-800">ภาพนี้เล็กกว่าที่แนะนำ (กว้าง {natural.w} px ต่ำกว่า {minWidth} px) อาจไม่คมบนจอใหญ่ ควรใช้ภาพที่ใหญ่กว่านี้</p>
              )}
              {safeZone && (
                <label className="flex min-h-8 items-center gap-2 text-neutral-700">
                  <input type="checkbox" checked={showSafe} onChange={(e) => setShowSafe(e.target.checked)} className="h-4 w-4" />
                  แสดงกรอบ “พื้นที่ปลอดภัย” — ข้อความสำคัญควรอยู่ในกรอบสีเหลือง
                </label>
              )}
            </div>
          )}

          <label className="flex items-center gap-3 text-sm">
            ซูม
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => changeZoom(+e.target.value)} className="flex-1" aria-label="ซูมรูป" />
            <span className="w-12 text-right text-neutral-500">{Math.round(zoom * 100)}%</span>
          </label>
          <p className="text-xs text-neutral-500">ลากรูปเพื่อเลือกส่วนที่ต้องการ ภาพผลลัพธ์จะถูกย่อให้กว้างไม่เกิน {maxWidth}px และเก็บเป็น WebP</p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={recenter} className="min-h-11 rounded-lg border border-neutral-300 px-4">รีเซ็ต</button>
            <button type="button" onClick={cancel} className="min-h-11 rounded-lg border border-neutral-300 px-4">ยกเลิก</button>
            <button type="button" onClick={confirm} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark">ใช้รูปนี้</button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
