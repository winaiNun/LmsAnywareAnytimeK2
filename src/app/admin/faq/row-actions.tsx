"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteFaq, moveFaq, setFaqActive, setFaqPinned } from "./actions";

const btn = "min-h-9 rounded-lg border border-neutral-300 px-3 text-xs disabled:opacity-40";

/** Move / pin / show-hide / edit / delete for one Q&A. */
export default function RowActions({ id, active, pinned, first, last }: { id: string; active: boolean; pinned: boolean; first: boolean; last: boolean }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" aria-label="เลื่อนขึ้น" disabled={pending || first} onClick={() => start(async () => { await moveFaq(id, "up"); })} className={btn}>ขึ้น</button>
      <button type="button" aria-label="เลื่อนลง" disabled={pending || last} onClick={() => start(async () => { await moveFaq(id, "down"); })} className={btn}>ลง</button>
      <Link href={`/admin/faq?edit=${id}`} className={`${btn} flex items-center`}>แก้ไข</Link>
      <button type="button" disabled={pending} onClick={() => start(async () => { await setFaqPinned(id, !pinned); })} className={`${btn} ${pinned ? "border-brand text-brand" : ""}`}>{pinned ? "เลิกปักหมุด" : "ปักหมุด"}</button>
      <button type="button" disabled={pending} onClick={() => start(async () => { await setFaqActive(id, !active); })} className={`${btn} ${active ? "border-amber-300 text-amber-800" : "border-green-300 text-green-800"}`}>{active ? "ซ่อน" : "แสดง"}</button>
      <button type="button" disabled={pending} onClick={() => { if (confirm("ลบคำถามนี้?")) start(async () => { const r = await deleteFaq(id); if (r.error) setMsg(r.error); }); }} className={`${btn} border-red-200 text-red-600`}>ลบ</button>
      {msg && <span role="alert" className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}
