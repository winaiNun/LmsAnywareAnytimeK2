"use client";

import { useRef } from "react";

/** Full-screen viewer shared by the three block kinds: a native <dialog> (focus trap, Esc to close) covering the screen. */
function FullScreen({ label, children, trigger }: { label: string; children: React.ReactNode; trigger: (open: () => void) => React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      {trigger(() => ref.current?.showModal())}
      <dialog
        ref={ref}
        aria-label={label}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-black/90 p-0 backdrop:bg-black/80 open:flex open:flex-col"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-2 text-white">
          <span className="min-w-0 truncate text-sm">{label}</span>
          <button type="button" onClick={() => ref.current?.close()} className="min-h-10 rounded-lg bg-white/15 px-4 text-sm font-medium hover:bg-white/25">ปิด ✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">{children}</div>
      </dialog>
    </>
  );
}

const expandIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
);

/** An uploaded picture (A4 or any shape): shown at reading width, tap for full screen. */
export function ContentImage({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="mx-auto w-full max-w-2xl">
      <FullScreen
        label={alt || "รูปภาพ"}
        trigger={(open) => (
          <button type="button" onClick={open} aria-label={`ดูเต็มจอ${alt ? `: ${alt}` : ""}`} className="group relative block w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} loading="lazy" decoding="async" className="mx-auto h-auto max-h-[85vh] w-auto max-w-full" />
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white opacity-90">{expandIcon} เต็มจอ</span>
          </button>
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="mx-auto h-auto max-h-full w-auto max-w-full object-contain" />
      </FullScreen>
      {alt && <figcaption className="mt-1.5 text-center text-sm text-neutral-500">{alt}</figcaption>}
    </figure>
  );
}

/** A Google Drive file (usually a PDF): preview card; the real file loads only when opened, so the page stays light. */
export function ContentDrive({ id, thumbSrc, title }: { id: string; thumbSrc: string | null; title: string }) {
  const label = title || "เอกสารจาก Google Drive";
  return (
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <FullScreen
        label={label}
        trigger={(open) =>
          thumbSrc ? (
            <button type="button" onClick={open} aria-label={`เปิดเต็มจอ: ${label}`} className="relative block w-full bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbSrc} alt={label} loading="lazy" decoding="async" className="mx-auto h-auto max-h-[70vh] w-auto max-w-full" />
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">{expandIcon} เปิดเต็มจอ</span>
            </button>
          ) : (
            <button type="button" onClick={open} className="flex min-h-24 w-full items-center justify-center gap-2 bg-neutral-50 px-4 text-sm font-medium text-brand">{expandIcon} เปิดเอกสารเต็มจอ</button>
          )
        }
      >
        <iframe title={label} src={`https://drive.google.com/file/d/${id}/preview`} allow="fullscreen" loading="lazy" className="h-full min-h-[70vh] w-full rounded-lg bg-white" />
      </FullScreen>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-3 py-2 text-sm">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <a href={`https://drive.google.com/file/d/${id}/view`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-2">เปิดใน Google Drive</a>
      </div>
    </div>
  );
}

/** Pasted HTML: always inside a sandboxed frame with no access to this site (no allow-same-origin), so it cannot read cookies or call our APIs. */
export function ContentHtml({ code }: { code: string }) {
  const frame = (cls: string) => <iframe title="เนื้อหา HTML" srcDoc={code} sandbox="allow-scripts allow-popups allow-modals" loading="lazy" className={cls} />;
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      {frame("block h-[480px] w-full")}
      <div className="flex justify-end border-t border-neutral-100 px-3 py-1.5">
        <FullScreen
          label="เนื้อหา HTML"
          trigger={(open) => <button type="button" onClick={open} className="flex min-h-9 items-center gap-1.5 text-sm font-medium text-brand">{expandIcon} เปิดเต็มจอ</button>}
        >
          {frame("h-full min-h-[80vh] w-full rounded-lg bg-white")}
        </FullScreen>
      </div>
    </div>
  );
}
