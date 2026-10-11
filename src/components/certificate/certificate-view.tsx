"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BUILTIN_FONTS, FIELD_LABEL, renderTemplate, type CertField, type CertValues, type FieldKey } from "@/lib/certificate/schema";

export type UsedFont = { id: string; name: string };

/** CSS family + weight for a design font key ("sarabun-600" or "f:<id>"). */
export function fontStyle(key: string): { fontFamily: string; fontWeight: number } {
  if (key.startsWith("f:")) return { fontFamily: `"CertFont-${key.slice(2)}", "Sarabun", sans-serif`, fontWeight: 400 };
  const b = BUILTIN_FONTS.find((f) => f.key === key) ?? BUILTIN_FONTS[0];
  return { fontFamily: `"Sarabun", sans-serif`, fontWeight: b.weight };
}

/** One text line that shrinks (never wraps) to stay inside its box, so a long name or title can never run off the paper. */
function FitText({ text, align, style }: { text: string; align: CertField["align"]; style: React.CSSProperties }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  const fit = () => {
    const b = box.current, i = inner.current;
    if (!b || !i) return;
    const need = i.offsetWidth, have = b.clientWidth; // offsetWidth ignores the current scale()

    setScale(need > have && need > 0 ? have / need : 1);
  };
  useLayoutEffect(fit, [text, style.fontFamily, style.fontSize]);
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    const onFonts = () => fit();
    document.fonts?.addEventListener?.("loadingdone", onFonts);
    document.fonts?.ready.then(fit);
    return () => { ro.disconnect(); document.fonts?.removeEventListener?.("loadingdone", onFonts); };
  }, []);

  const origin = align === "left" ? "left center" : align === "right" ? "right center" : "center";
  return (
    <div ref={box} style={{ width: "100%", textAlign: align }}>
      <span ref={inner} style={{ ...style, display: "inline-block", whiteSpace: "nowrap", lineHeight: 1.3, transform: `scale(${scale})`, transformOrigin: origin }}>{text || " "}</span>
    </div>
  );
}

type Props = {
  imageSrc: string | null;
  aspect: number; // width / height of the template
  fields: CertField[];
  values: Partial<CertValues>;
  usedFonts?: UsedFont[]; // uploaded fonts that the design uses (loaded through /api/certificate-fonts/[id])
  /** "boxes": dashed outlines + labels (the position view); editable: they can be dragged. */
  boxes?: boolean;
  editable?: boolean;
  selected?: FieldKey | null;
  onSelect?: (key: FieldKey) => void;
  onMove?: (key: FieldKey, x: number, y: number) => void;
  watermark?: string;
  className?: string;
};

/**
 * The one certificate renderer: the designer, the learner's page, the print page and the verification page all use it, so
 * what is previewed is exactly what is printed. Sizes are relative to the certificate's own width (container query units).
 */
export default function CertificateView({ imageSrc, aspect, fields, values, usedFonts = [], boxes = false, editable = false, selected = null, onSelect, onMove, watermark, className = "" }: Props) {
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: FieldKey; px: number; py: number; x: number; y: number; w: number } | null>(null);

  function down(e: React.PointerEvent, f: CertField) {
    onSelect?.(f.key);
    if (!editable) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { key: f.key, px: e.clientX, py: e.clientY, x: f.x, y: f.y, w: f.w };
  }
  function move(e: React.PointerEvent) {
    const d = drag.current, r = sheet.current?.getBoundingClientRect();
    if (!d || !r) return;
    const x = Math.min(100 - d.w, Math.max(0, d.x + ((e.clientX - d.px) / r.width) * 100));
    const y = Math.min(100, Math.max(0, d.y + ((e.clientY - d.py) / r.height) * 100));
    onMove?.(d.key, Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  }
  const up = () => { drag.current = null; };

  return (
    <div className={`cert-sheet relative w-full overflow-hidden bg-white ${className}`} style={{ aspectRatio: String(aspect), containerType: "inline-size", ["--ar" as string]: aspect } as React.CSSProperties} ref={sheet}>
      {usedFonts.length > 0 && <style>{usedFonts.map((f) => `@font-face{font-family:"CertFont-${f.id}";src:url("/api/certificate-fonts/${f.id}");font-display:block;}`).join("")}</style>}
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-200 text-[2.2cqw] text-neutral-500">ยังไม่ได้ใส่ภาพเทมเพลต</div>
      )}

      {fields.filter((f) => f.enabled).map((f) => {
        const text = renderTemplate(f.text, values);
        const on = selected === f.key;
        return (
          <div
            key={f.key}
            onPointerDown={boxes ? (e) => down(e, f) : undefined}
            onPointerMove={boxes && editable ? move : undefined}
            onPointerUp={boxes && editable ? up : undefined}
            style={{ position: "absolute", left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, transform: "translateY(-50%)", touchAction: editable ? "none" : undefined, cursor: boxes && editable ? "move" : undefined }}
            className={boxes ? `outline outline-[0.25cqw] ${on ? "bg-brand/15 outline-brand" : "bg-sky-400/10 outline-dashed outline-sky-500"}` : ""}
          >
            <FitText text={text} align={f.align} style={{ ...fontStyle(f.font), fontSize: `${f.size / 10}cqw`, color: f.color }} />
            {boxes && <span className={`pointer-events-none absolute -top-[2.6cqw] left-0 whitespace-nowrap rounded px-[0.8cqw] py-[0.2cqw] text-[1.5cqw] font-semibold leading-tight text-white ${on ? "bg-brand" : "bg-sky-600"}`} style={{ fontFamily: "Sarabun, sans-serif" }}>{FIELD_LABEL[f.key].label}</span>}
          </div>
        );
      })}

      {watermark && (
        <div className="cert-watermark pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="-rotate-[18deg] whitespace-nowrap rounded-[1cqw] border-[0.4cqw] border-red-500/60 px-[3cqw] py-[1cqw] text-[6cqw] font-bold text-red-500/50" style={{ fontFamily: "Sarabun, sans-serif" }}>{watermark}</span>
        </div>
      )}
    </div>
  );
}
