"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteStatCard, moveStatCard, resetStatCards, setStatCardVisible } from "./actions";

const btn = "min-h-9 rounded-lg border border-neutral-300 px-3 text-xs disabled:opacity-40";

/** Move / edit / show-hide / delete for one card. */
export function CardActions({ id, visible, first, last }: { id: string; visible: boolean; first: boolean; last: boolean }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" aria-label="เลื่อนขึ้น" disabled={pending || first} onClick={() => start(async () => { await moveStatCard(id, "up"); })} className={btn}>ขึ้น</button>
      <button type="button" aria-label="เลื่อนลง" disabled={pending || last} onClick={() => start(async () => { await moveStatCard(id, "down"); })} className={btn}>ลง</button>
      <Link href={`/admin/stat-cards?edit=${id}`} className={`${btn} flex items-center`}>แก้ไข</Link>
      <button type="button" disabled={pending} onClick={() => start(async () => { await setStatCardVisible(id, !visible); })} className={`${btn} ${visible ? "border-amber-300 text-amber-800" : "border-green-300 text-green-800"}`}>{visible ? "ซ่อน" : "แสดง"}</button>
      <button type="button" disabled={pending} onClick={() => { if (confirm("ลบการ์ดนี้?")) start(async () => { const r = await deleteStatCard(id); if (r.error) setMsg(r.error); }); }} className={`${btn} border-red-200 text-red-600`}>ลบ</button>
      {msg && <span role="alert" className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}

/** Back to the four starter cards. */
export function ResetButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => { if (confirm("คืนค่าเริ่มต้น? การ์ดทั้งหมดที่ตั้งไว้จะถูกแทนที่ด้วยการ์ดเริ่มต้น 4 ใบ")) start(async () => { await resetStatCards(); }); }} className={btn}>
      {pending ? "กำลังคืนค่า..." : "คืนค่าเริ่มต้น"}
    </button>
  );
}
