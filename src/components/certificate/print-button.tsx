"use client";

import { useState } from "react";

/** Waits for the fonts, then opens the browser's print dialog ("Save as PDF" is one of its printers). */
export default function PrintButton({ label = "พิมพ์ / บันทึกเป็น PDF" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try { await document.fonts?.ready; } catch { /* print anyway */ }
        setBusy(false);
        window.print();
      }}
      className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
    >{busy ? "กำลังเตรียม…" : label}</button>
  );
}
