"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AvatarData } from "@/lib/avatar";
import Avatar from "./avatar";
import Glyph, { IconTile } from "./glyph";

export type DrawerArea = { slug: string; name: string; icon: string; color: string };
export type DrawerUser = { name: string; isStaff: boolean; canReview: boolean; canTeach?: boolean; avatar: AvatarData | null };

const row = "flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-neutral-800 active:bg-neutral-100";

/**
 * Phone-only "more" menu (hamburger, top right). The bottom tab bar keeps the everyday places; this drawer holds
 * the rest: the learning areas, my media / review / back office, about, install, sign out.
 */
export default function NavDrawer({ user, areas, aboutLabel = "เกี่ยวกับ" }: { user: DrawerUser | null; areas: DrawerArea[]; aboutLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  // close after navigating
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    setInstallable(document.documentElement.dataset.pwaInstallable === "1");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind must not scroll
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panel.current) { // keep focus inside the drawer
        const f = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const button = opener.current;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="เปิดเมนู"
        aria-expanded={open}
        aria-controls="nav-drawer"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200 md:hidden"
      >
        <Glyph name="menu" size={24} strokeWidth={1.9} />
      </button>

      {/* Portalled to <body>: the header has a backdrop-filter, which would otherwise make this "fixed" layer relative to the 56px header instead of the screen. */}
      {mounted && createPortal(
      <div className={`fixed inset-0 z-[70] md:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-neutral-900/50 backdrop-blur-[2px] transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} />
        <div
          id="nav-drawer"
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="เมนู"
          className={`absolute inset-y-0 right-0 flex w-[min(86vw,22rem)] flex-col bg-white shadow-2xl transition-transform duration-250 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
            {user ? (
              <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
                <Avatar avatar={user.avatar} name={user.name || "?"} size={44} className="ring-2 ring-brand-soft" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{user.name || "บัญชีของฉัน"}</span>
                  <span className="block text-xs text-brand">ดูบัญชีของฉัน</span>
                </span>
              </Link>
            ) : (
              <Link href="/login" className="flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white">เข้าสู่ระบบ</Link>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="ปิดเมนู" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100">
              <Glyph name="x" size={22} strokeWidth={1.9} />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4">
            {!user && <Link href="/register" className={`${row} border border-brand/30 bg-brand-soft text-brand`}><Glyph name="sparkles" size={20} />สมัครสมาชิก</Link>}

            <section aria-label="กลุ่มสาระ">
              <h2 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">กลุ่มสาระ</h2>
              <ul className="grid grid-cols-1">
                {areas.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/library?area=${a.slug}`} className={row}>
                      <IconTile name={a.icon} color={a.color} size={34} />
                      <span className="min-w-0 flex-1 leading-snug">{a.name}</span>
                      <Glyph name="chevron-right" size={16} className="shrink-0 text-neutral-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="เมนูอื่น" className="space-y-0.5 border-t border-neutral-100 pt-3">
              {user && <Link href="/dashboard/media" className={row}><Glyph name="file-text" size={20} className="text-neutral-500" />สื่อของฉัน</Link>}
              {user && <Link href="/dashboard/learning" className={row}><Glyph name="book-open" size={20} className="text-neutral-500" />คอร์สที่ฉันเรียน</Link>}
              {user && <Link href="/dashboard/certificates" className={row}><Glyph name="trophy" size={20} className="text-neutral-500" />เกียรติบัตรของฉัน</Link>}
              {user?.canTeach && <Link href="/dashboard/courses" className={row}><Glyph name="play-circle" size={20} className="text-neutral-500" />คอร์สของฉัน (ผู้สอน)</Link>}
              {user?.canReview && <Link href="/dashboard/review" className={row}><Glyph name="clipboard-check" size={20} className="text-neutral-500" />ตรวจสื่อ</Link>}
              {user?.isStaff && <Link href="/admin" className={row}><Glyph name="wrench" size={20} className="text-neutral-500" />จัดการระบบ</Link>}
              <Link href="/about" className={row}><Glyph name="help-circle" size={20} className="text-neutral-500" />{aboutLabel}</Link>
              {installable && (
                <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event("pwa-open")); }} className={`${row} w-full text-left`}>
                  <Glyph name="download" size={20} className="text-neutral-500" />ติดตั้งแอปบนหน้าจอ
                </button>
              )}
            </section>
          </div>

          {user && (
            <div className="border-t border-neutral-100 p-3">
              <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className={`${row} w-full text-left text-red-600`}>
                <Glyph name="logout" size={20} />ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>,
      document.body,
      )}
    </>
  );
}
