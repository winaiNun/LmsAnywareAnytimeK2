"use client";

import { useState, useTransition } from "react";
import { deleteCode, setCodeActive } from "./actions";

/** Copy / switch off / delete for one code row. `code` arrives already formatted (ABCD-EFGH). */
export default function RowActions({ id, code, active, used }: { id: string; code: string; active: boolean; used: number }) {
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const btn = "min-h-9 rounded-lg border border-neutral-300 px-3 text-xs";

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMsg("คัดลอกไม่ได้ — เลือกข้อความรหัสแล้วคัดลอกเอง");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={copy} className={btn}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}</button>
      <button type="button" disabled={pending} onClick={() => start(async () => { await setCodeActive(id, !active); })} className={`${btn} ${active ? "border-amber-300 text-amber-800" : "border-green-300 text-green-800"}`}>
        {active ? "ปิดรหัส" : "เปิดรหัส"}
      </button>
      {used === 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => { if (confirm("ลบรหัสนี้?")) start(async () => { const r = await deleteCode(id); if (r.error) setMsg(r.error); }); }}
          className={`${btn} border-red-200 text-red-600`}
        >
          ลบ
        </button>
      )}
      {msg && <span role="alert" className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}
