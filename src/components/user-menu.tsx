"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import type { AvatarData } from "@/lib/avatar";
import Avatar from "./avatar";
import Glyph from "./glyph";

export type MenuUser = { name: string; typeLabel: string; isStaff: boolean; canReview: boolean; canTeach?: boolean; avatar: AvatarData | null };

const item = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-neutral-800 outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100";

/** Desktop account menu: picture + name + arrow; opens a dropdown with account, my media, review, back office and sign out. */
export default function UserMenu({ user, context = "site" }: { user: MenuUser; context?: "site" | "admin" }) {
  const admin = context === "admin";
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    items()[0]?.focus();
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
      else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
      else if (e.key === "End") { e.preventDefault(); list[list.length - 1]?.focus(); }
      else if (e.key === "Tab") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        className={`flex min-h-10 items-center gap-2 rounded-full py-1 pl-1 text-sm font-semibold transition ${admin ? `pr-2 text-white hover:bg-white/15 sm:pr-3 ${open ? "bg-white/20" : "bg-white/10"}` : `pr-3 text-brand hover:bg-brand-soft/70 ${open ? "bg-brand-soft" : "bg-brand-soft/60"}`}`}
      >
        <Avatar avatar={user.avatar} name={user.name || "?"} size={32} className="ring-2 ring-white" />
        <span className={`max-w-[10rem] truncate ${admin ? "hidden sm:inline" : ""}`}>{user.name || "บัญชีของฉัน"}</span>
        <Glyph name="chevron-down" size={16} strokeWidth={2} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id="user-menu" ref={menu} role="menu" aria-label="เมนูบัญชี" className="absolute right-0 top-full z-[60] mt-2 w-64 origin-top-right rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
          <div className="flex items-center gap-3 px-3 py-2.5" role="presentation">
            <Avatar avatar={user.avatar} name={user.name || "?"} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name || "บัญชีของฉัน"}</p>
              <p className="truncate text-xs text-neutral-500">{user.typeLabel}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-neutral-100" role="separator" />
          <Link role="menuitem" href="/dashboard" className={item}><Glyph name="users" size={18} className="text-neutral-500" />บัญชีของฉัน</Link>
          <Link role="menuitem" href="/dashboard/media" className={item}><Glyph name="file-text" size={18} className="text-neutral-500" />สื่อของฉัน</Link>
          <Link role="menuitem" href="/dashboard/learning" className={item}><Glyph name="book-open" size={18} className="text-neutral-500" />คอร์สที่ฉันเรียน</Link>
          <Link role="menuitem" href="/dashboard/certificates" className={item}><Glyph name="trophy" size={18} className="text-neutral-500" />เกียรติบัตรของฉัน</Link>
          {user.canTeach && <Link role="menuitem" href="/dashboard/courses" className={item}><Glyph name="play-circle" size={18} className="text-neutral-500" />คอร์สของฉัน (ผู้สอน)</Link>}
          {user.canReview && <Link role="menuitem" href="/dashboard/review" className={item}><Glyph name="clipboard-check" size={18} className="text-neutral-500" />ตรวจสื่อ</Link>}
          {admin
            ? <Link role="menuitem" href="/" className={item}><Glyph name="home" size={18} className="text-neutral-500" />ดูหน้าเว็บไซต์</Link>
            : user.isStaff && <Link role="menuitem" href="/admin" className={item}><Glyph name="wrench" size={18} className="text-neutral-500" />จัดการระบบ</Link>}
          <div className="my-1 h-px bg-neutral-100" role="separator" />
          <button role="menuitem" type="button" onClick={() => signOut({ callbackUrl: "/login" })} className={`${item} text-red-600 hover:bg-red-50 focus-visible:bg-red-50`}>
            <Glyph name="logout" size={18} />ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  );
}
