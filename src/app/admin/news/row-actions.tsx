"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteItem, deleteTab, moveTab, refreshFeed, setItemActive, setItemPinned, setTabActive } from "./actions";

const btn = "min-h-9 rounded-lg border border-neutral-300 px-3 text-xs disabled:opacity-40";

/** Edit / pin / show-hide / re-fetch / delete for one news item. */
export function ItemActions({ id, kind, active, pinned }: { id: string; kind: "LINK" | "FEED"; active: boolean; pinned: boolean }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={`/admin/news?edit=${id}`} className={`${btn} flex items-center`}>แก้ไข</Link>
      {kind === "LINK" && <button type="button" disabled={pending} onClick={() => start(async () => { await setItemPinned(id, !pinned); })} className={`${btn} ${pinned ? "border-brand text-brand" : ""}`}>{pinned ? "เลิกปักหมุด" : "ปักหมุด"}</button>}
      {kind === "FEED" && <button type="button" disabled={pending} onClick={() => start(async () => { await refreshFeed(id); setMsg("ล้างสำเนาแล้ว — เข้าหน้าเว็บจะดึงข่าวใหม่"); })} className={btn}>ดึงฟีดใหม่</button>}
      <button type="button" disabled={pending} onClick={() => start(async () => { await setItemActive(id, !active); })} className={`${btn} ${active ? "border-amber-300 text-amber-800" : "border-green-300 text-green-800"}`}>{active ? "ซ่อน" : "แสดง"}</button>
      <button type="button" disabled={pending} onClick={() => { if (confirm("ลบรายการนี้?")) start(async () => { const r = await deleteItem(id); if (r.error) setMsg(r.error); }); }} className={`${btn} border-red-200 text-red-600`}>ลบ</button>
      {msg && <span role="status" className="w-full text-xs text-neutral-600">{msg}</span>}
    </div>
  );
}

/** Move / edit / show-hide / delete for one tab. Deleting also deletes its items. */
export function TabActions({ id, name, active, first, last, itemCount }: { id: string; name: string; active: boolean; first: boolean; last: boolean; itemCount: number }) {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" aria-label="เลื่อนขึ้น" disabled={pending || first} onClick={() => start(async () => { await moveTab(id, "up"); })} className={btn}>ขึ้น</button>
      <button type="button" aria-label="เลื่อนลง" disabled={pending || last} onClick={() => start(async () => { await moveTab(id, "down"); })} className={btn}>ลง</button>
      <Link href={`/admin/news?view=tabs&editTab=${id}`} className={`${btn} flex items-center`}>แก้ไข</Link>
      <button type="button" disabled={pending} onClick={() => start(async () => { await setTabActive(id, !active); })} className={`${btn} ${active ? "border-amber-300 text-amber-800" : "border-green-300 text-green-800"}`}>{active ? "ซ่อน" : "แสดง"}</button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const warn = itemCount > 0 ? `ลบหัวข้อ “${name}” พร้อมรายการข่าวทั้ง ${itemCount} รายการในหัวข้อนี้?` : `ลบหัวข้อ “${name}”?`;
          if (confirm(warn)) start(async () => { const r = await deleteTab(id); if (r.error) setMsg(r.error); });
        }}
        className={`${btn} border-red-200 text-red-600`}
      >ลบ</button>
      {msg && <span role="alert" className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}
