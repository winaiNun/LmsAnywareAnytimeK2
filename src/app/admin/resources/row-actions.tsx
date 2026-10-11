"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteResource, moveResource, setResourceActive } from "./actions";

/** Move / show-hide / edit / delete for one outside source. */
export default function RowActions({ id, active, first, last }: { id: string; active: boolean; first: boolean; last: boolean }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const btn = "min-h-9 rounded-lg border border-neutral-300 px-3 text-xs disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" aria-label="เลื่อนขึ้น" disabled={pending || first} onClick={() => start(async () => { await moveResource(id, "up"); })} className={btn}>ขึ้น</button>
      <button type="button" aria-label="เลื่อนลง" disabled={pending || last} onClick={() => start(async () => { await moveResource(id, "down"); })} className={btn}>ลง</button>
      <Link href={`/admin/resources?edit=${id}`} className={`${btn} flex items-center`}>แก้ไข</Link>
      <button type="button" disabled={pending} onClick={() => start(async () => { await setResourceActive(id, !active); })} className={`${btn} ${active ? "border-amber-300 text-amber-800" : "border-green-300 text-green-800"}`}>{active ? "ซ่อน" : "แสดง"}</button>
      <button type="button" disabled={pending} onClick={() => { if (confirm("ลบรายการนี้?")) start(async () => { const r = await deleteResource(id); if (r.error) setMsg(r.error); }); }} className={`${btn} border-red-200 text-red-600`}>ลบ</button>
      {msg && <span role="alert" className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}
