"use client";

import Link from "next/link";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/#media", label: "สื่อการเรียนรู้" },
  { href: "/#courses", label: "คอร์สเรียน" },
  { href: "/#about", label: "เกี่ยวกับ" },
];

type Props = { user: { name: string; isStaff: boolean } | null; name: string; logoUrl: string | null };

/** Full-width navbar pinned to the top, blurred over the banner. */
export default function NavbarClient({ user, name, logoUrl }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-neutral-200 bg-white/85 shadow-sm shadow-black/5 backdrop-blur-md">
      <div className="w-full">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-9 w-9 object-contain" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
                  <path d="M8 7h7" />
                </svg>
              </span>
            )}
            <span className="truncate">{name}</span>
          </Link>

          <nav aria-label="เมนูหลัก" className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[15px] text-neutral-700 hover:bg-brand-soft hover:text-brand">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {user.isStaff && (
                  <Link href="/admin" className="hidden min-h-10 items-center rounded-full border border-neutral-200 px-4 text-sm font-medium hover:bg-neutral-50 sm:flex">
                    จัดการระบบ
                  </Link>
                )}
                <Link href="/dashboard" className="flex min-h-10 items-center rounded-full bg-brand-soft px-4 text-sm font-semibold text-brand">
                  {user.name || "บัญชีของฉัน"}
                </Link>
              </>
            ) : (
              <Link href="/login" className="flex min-h-10 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">
                เข้าสู่ระบบ
              </Link>
            )}
            <button
              type="button"
              aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 md:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <nav aria-label="เมนูมือถือ" className="mx-auto flex max-w-6xl flex-col border-t border-neutral-100 p-2 md:hidden">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 hover:bg-brand-soft">
                {l.label}
              </Link>
            ))}
            {user?.isStaff && (
              <Link href="/admin" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 hover:bg-brand-soft">
                จัดการระบบ
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
