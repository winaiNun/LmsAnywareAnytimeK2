"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { fetchAvatarFromDrive, removeAvatar, saveAvatarDrive, saveAvatarUpload } from "@/app/dashboard/actions";
import Avatar from "@/components/avatar";
import { Spinner } from "@/components/icons";
import { AVATAR_OUT, MAX_ZOOM, avatarBox, clampCenter, type AvatarData } from "@/lib/avatar";

type Source = { kind: "upload"; src: string; w: number; h: number } | { kind: "drive"; src: string; w: number; h: number; link: string };

/**
 * Profile picture editor. Two ways in, like the slideshow: upload + crop (only while the admin allows server
 * uploads) or a public Google Drive link (nothing is stored on our server — only the link and the crop window).
 * Both open the same circular cropper: drag to position, slide to zoom.
 */
export default function AvatarEditor({ avatar, name, allowUpload }: { avatar: AvatarData | null; name: string; allowUpload: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const [tab, setTab] = useState<"upload" | "drive">(allowUpload ? "upload" : "drive");
  const [link, setLink] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [crop, setCrop] = useState({ cx: 0.5, cy: 0.5, zoom: 1 });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  const aspect = source ? source.w / source.h : 1;

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
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => openCropper({ kind: "upload", src: url, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => { URL.revokeObjectURL(url); setError("เปิดไฟล์รูปนี้ไม่ได้ กรุณาเลือกไฟล์ PNG, JPG หรือ WebP"); };
    img.src = url;
  }

  async function fetchDrive() {
    setError("");
    if (!link.trim()) return setError("วางลิงก์ไฟล์จาก Google Drive ก่อน");
    setBusy(true);
    try {
      const r = await fetchAvatarFromDrive(link);
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

  function move(dxPx: number, dyPx: number, from: { cx: number; cy: number }) {
    const side = view.current?.clientWidth ?? 1;
    const dw = (aspect >= 1 ? crop.zoom * aspect : crop.zoom) * side;
    const dh = (aspect >= 1 ? crop.zoom : crop.zoom / aspect) * side;
    setCrop((c) => ({ ...c, ...clampCenter(from.cx - dxPx / dw, from.cy - dyPx / dh, c.zoom, aspect) }));
  }

  async function confirm() {
    if (!source) return;
    setError("");
    if (source.kind === "drive") {
      start(async () => {
        const r = await saveAvatarDrive({ link: source.link, ...crop, aspect });
        if (r?.error) return setError(r.error);
        closeCropper();
        router.refresh();
      });
      return;
    }
    // upload: render the chosen circle's bounding square to a small WebP
    const img = new Image();
    img.src = source.src;
    await img.decode();
    const side = Math.min(source.w, source.h) / crop.zoom;
    const sx = crop.cx * source.w - side / 2;
    const sy = crop.cy * source.h - side / 2;
    const out = Math.min(AVATAR_OUT, Math.round(side));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
    if (!blob) return setError("สร้างรูปไม่สำเร็จ");
    const fd = new FormData();
    fd.set("avatar", new File([blob], "avatar.webp", { type: "image/webp" }));
    start(async () => {
      const r = await saveAvatarUpload(fd);
      if (r?.error) return setError(r.error);
      closeCropper();
      router.refresh();
    });
  }

  const tabBtn = (t: "upload" | "drive", label: string) => (
    <button type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(""); }} className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold ${tab === t ? "bg-white text-brand shadow" : "text-neutral-600"}`}>
      {label}
    </button>
  );

  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">รูปโปรไฟล์</h2>
      <div className="flex flex-wrap items-center gap-5">
        <Avatar avatar={avatar} name={name} size={112} className="ring-4 ring-brand-soft" />
        <div className="min-w-0 flex-1 space-y-3">
          <div role="tablist" className="flex gap-1 rounded-xl bg-neutral-100 p-1">
            {allowUpload && tabBtn("upload", "อัปโหลดรูป")}
            {tabBtn("drive", "ลิงก์ Google Drive")}
          </div>

          {tab === "upload" && allowUpload ? (
            <div className="space-y-1">
              <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="เลือกรูปโปรไฟล์" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} className="block w-full text-sm" />
              <p className="text-xs text-neutral-500">เลือกรูปแล้วจะเปิดเครื่องมือครอบวงกลม ลากเลือกตำแหน่งและซูมได้ · ไม่เกิน 4 MB</p>
            </div>
          ) : (
            <div className="space-y-2">
              {!allowUpload && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">ขณะนี้ระบบใช้ลิงก์ Google Drive เป็นหลัก (ผู้ดูแลปิดการอัปโหลดรูปเข้าเซิร์ฟเวอร์ไว้)</p>}
              <div className="flex flex-wrap gap-2">
                <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchDrive(); } }} placeholder="https://drive.google.com/file/d/…/view" aria-label="ลิงก์ Google Drive" className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 text-sm" />
                <button type="button" onClick={fetchDrive} disabled={busy} className="flex min-h-11 items-center gap-2 rounded-lg border border-brand bg-brand-soft px-4 text-sm font-semibold text-brand disabled:opacity-60">
                  {busy && <Spinner className="h-4 w-4" />}{busy ? "กำลังดึงภาพ…" : "ดึงภาพและครอบ"}
                </button>
              </div>
            </div>
          )}
          {error && !source && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {avatar && <button type="button" onClick={() => start(async () => { await removeAvatar(); router.refresh(); })} className="min-h-10 text-sm text-red-600 underline">ลบรูปโปรไฟล์</button>}
        </div>
      </div>

      {tab === "drive" && (
        <div className="space-y-2 rounded-xl bg-brand-soft/60 p-4 text-sm text-neutral-700">
          <p className="font-semibold text-neutral-900">ภาพแบบไหนเหมาะ (ใช้ลิงก์ Drive)</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>สี่เหลี่ยมจัตุรัส 1:1</strong> ขนาด <strong>512 × 512 px</strong> (อย่างน้อย 400 × 400, ไม่ควรเกิน 2000 × 2000) ภาพที่ไม่ใช่จัตุรัสก็ได้ แต่ต้องเลือกส่วนที่จะแสดงในวงกลม</li>
            <li>ไฟล์ JPG หรือ PNG ไม่เกิน 2 MB · ใบหน้าอยู่กึ่งกลาง เว้นพื้นที่รอบศีรษะเล็กน้อย เพราะมุมภาพจะถูกตัดเป็นวงกลม</li>
            <li>ทำภาพ 1:1 ได้ง่ายๆ ใน Canva (สร้างดีไซน์ “กำหนดขนาดเอง” 512 × 512) หรือครอบในโทรศัพท์ก่อนอัปโหลดขึ้น Drive</li>
            <li>ใน Drive กด “แชร์” → ตั้งเป็น <strong>“ทุกคนที่มีลิงก์” (ผู้ดู)</strong> แล้วคัดลอกลิงก์มาวาง</li>
            <li>ระบบแสดงรูปจาก Drive โดยตรง ไม่เก็บไฟล์ไว้ในเซิร์ฟเวอร์ ถ้าลบไฟล์หรือเลิกแชร์ รูปจะหายและแสดงตัวอักษรแทน</li>
          </ul>
        </div>
      )}

      <dialog ref={dialog} aria-label="ครอบรูปโปรไฟล์" onCancel={closeCropper} className="w-[min(94vw,460px)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/60">
        <div className="space-y-4 p-5">
          <h3 className="text-lg font-bold">ครอบรูปโปรไฟล์</h3>
          <div
            ref={view}
            className="relative mx-auto aspect-square w-full max-w-[360px] cursor-grab touch-none select-none overflow-hidden rounded-xl bg-neutral-200 active:cursor-grabbing"
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
            {/* the circle that will be kept; everything outside is dimmed */}
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(0,0,0,0.55)] ring-2 ring-white" />
          </div>
          {source && <p className="text-center text-xs text-neutral-500">ภาพต้นฉบับ {source.w}×{source.h} px{Math.min(source.w, source.h) < 400 ? " — เล็กกว่า 400 px อาจไม่คม ควรใช้ภาพใหญ่กว่านี้" : ""}</p>}
          <label className="flex items-center gap-3 text-sm">
            ซูม
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom} onChange={(e) => setZoom(+e.target.value)} className="flex-1" aria-label="ซูมรูป" />
            <span className="w-12 text-right text-neutral-500">{Math.round(crop.zoom * 100)}%</span>
          </label>
          <p className="text-xs text-neutral-500">ลากรูปเพื่อเลือกส่วนที่จะแสดงในวงกลม</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCrop({ cx: 0.5, cy: 0.5, zoom: 1 })} className="min-h-11 rounded-lg border border-neutral-300 px-4">รีเซ็ต</button>
            <button type="button" onClick={closeCropper} className="min-h-11 rounded-lg border border-neutral-300 px-4">ยกเลิก</button>
            <button type="button" onClick={confirm} disabled={pending} className="flex min-h-11 items-center gap-2 rounded-lg bg-brand px-6 font-semibold text-white disabled:opacity-60">{pending && <Spinner className="h-4 w-4" />}ใช้รูปนี้</button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
