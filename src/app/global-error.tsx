"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client";

/** Last resort: the root layout itself broke. Plain markup only (no fonts, no components that may be the thing that broke). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError({ source: "boundary", message: error.message, stack: error.stack, digest: error.digest }), [error]);
  return (
    <html lang="th">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, background: "#f9f9f9", color: "#1e1e1e", textAlign: "center", padding: 16 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>เกิดข้อผิดพลาดบางอย่าง</h1>
          <p style={{ color: "#555" }}>ขออภัย ระบบขัดข้องชั่วคราว ลองโหลดใหม่อีกครั้ง หากยังเป็นอยู่ โปรดแจ้งผู้ดูแลระบบ</p>
          <button onClick={reset} style={{ minHeight: 48, padding: "0 24px", borderRadius: 12, border: 0, background: "#0052FF", color: "#fff", fontSize: 16, fontWeight: 600 }}>ลองอีกครั้ง</button>
        </div>
      </body>
    </html>
  );
}
