"use client";

import { useEffect, useRef, useState } from "react";
import Glyph from "@/components/glyph";
import { sizeLabel } from "@/lib/format-size";
import type { ViewItem } from "@/lib/media-view"; // type only: the module itself is server-side (storage)

const SHAPE = { video: "aspect-video", tall: "h-[72vh] min-h-[420px]", audio: "h-[232px]" } as const;

const btn = "inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50";

/**
 * Opens one media item. Framed (sandboxed) when the site allows it, otherwise a clear "open link" card.
 * `mediaId` is set on the public page so a click on download/open is counted; reviewers' previews pass null.
 */
export default function MediaViewer({ item, mediaId }: { item: ViewItem; mediaId: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [canFull, setCanFull] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setCanFull(!!document.fullscreenEnabled), []);

  const count = () => {
    if (mediaId) try { navigator.sendBeacon(`/api/media/${mediaId}/open`); } catch {}
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      {item.openUrl && (
        <a href={item.openUrl} target="_blank" rel="noopener noreferrer" onClick={count} className={btn}>
          {item.frameSrc ? "เปิดในแท็บใหม่" : "เปิดลิงก์"} <Glyph name="external-link" size={16} />
        </a>
      )}
      {item.downloadUrl && (
        <a href={item.downloadUrl} target="_blank" rel="noopener noreferrer" onClick={count} className={btn}>
          <Glyph name="download" size={16} />ดาวน์โหลด{item.sizeBytes ? ` (${sizeLabel(item.sizeBytes)})` : ""}
        </a>
      )}
      {item.frameSrc && canFull && (
        <button type="button" onClick={() => box.current?.requestFullscreen?.().catch(() => {})} className={btn}><Glyph name="maximize" size={16} />เต็มจอ</button>
      )}
    </div>
  );

  // Not frameable (most websites forbid it): a card with one obvious button.
  if (!item.frameSrc) {
    return (
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{item.kindLabel} · {item.provider}</p>
        <p className="text-lg font-semibold">{item.label || item.provider}</p>
        <p className="text-sm text-neutral-500">สื่อนี้เปิดบนเว็บไซต์ต้นทาง กดปุ่มเพื่อเปิดในแท็บใหม่</p>
        {actions}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div ref={box} className={`relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 ${SHAPE[item.shape]}`}>
        {!loaded && <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400" aria-hidden>กำลังโหลด…</div>}
        <iframe
          src={item.frameSrc}
          title={item.label || item.provider}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          allow="fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write"
          allowFullScreen
          // HTML apps get ONLY scripts (no same-origin: they cannot reach our cookies or session); other sites get the normal set minus top-level navigation
          sandbox={item.isHtml ? "allow-scripts" : "allow-scripts allow-same-origin allow-popups allow-forms allow-presentation allow-downloads allow-modals"}
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0 bg-white"
        />
      </div>
      {item.kind === "APPS_SCRIPT" && (
        <p className="text-xs text-neutral-500">ถ้าหน้านี้ว่างเปล่า แสดงว่าสคริปต์ไม่อนุญาตให้ฝัง (ต้องตั้ง <code>XFrameOptionsMode.ALLOWALL</code>) — กด “เปิดในแท็บใหม่”</p>
      )}
      {actions}
    </div>
  );
}
