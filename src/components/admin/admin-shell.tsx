"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const ICONS: Record<string, string> = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  banner: "M3 5h18v10H3zM8 19h8M12 15v4",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7",
  course: "M5 3l14 9-14 9z",
  layout: "M3 4h18v5H3zM3 13h8v7H3zM15 13h6v7h-6z",
  school: "M3 10.2 12 4l9 6.2M5 10v9.5a.5.5 0 0 0 .5.5H9v-5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V20h3.5a.5.5 0 0 0 .5-.5V10M12 4V2M12 2h3",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
};

type NavItem = { href: string; label: string; icon: string; exact?: boolean; teacher?: boolean };
const GROUPS: { title: string; items: NavItem[] }[] = [
  { title: "ภาพรวม", items: [{ href: "/admin", label: "แดชบอร์ด", icon: "dashboard", exact: true }] },
  {
    title: "เนื้อหา",
    items: [
      { href: "/admin/books", label: "คลังสื่อการเรียนรู้", icon: "book" },
      { href: "/admin/courses", label: "คอร์สเรียน", icon: "course" },
      { href: "/admin/sections", label: "เซกชันหน้าแรก", icon: "layout" },
      { href: "/admin/schools", label: "โรงเรียน", icon: "school" },
      { href: "/admin/banners", label: "สไลด์แนะนำ", icon: "banner", teacher: true },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { href: "/admin/users", label: "สมาชิก", icon: "users" },
      { href: "/admin/settings", label: "ตั้งค่าเขตพื้นที่", icon: "settings" },
    ],
  },
];

const Icon = ({ name, className = "h-5 w-5" }: { name: string; className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={ICONS[name]} />
  </svg>
);

type Props = {
  site: { systemName: string; logoUrl: string | null };
  user: { name: string; role: string };
  children: React.ReactNode;
};

export default function AdminShell({ site, user, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Teachers (lesson creators) only get the pages they may use.
  const manager = user.role === "ADMIN" || user.role === "LIBRARIAN";
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => manager || it.teacher) })).filter((g) => g.items.length > 0);

  const sidebar = (
    <div className="flex h-full flex-col bg-white">
      <Link href={manager ? "/admin" : "/admin/banners"} className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 px-5 font-bold">
        {site.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={site.logoUrl} alt="" className="h-8 w-8 object-contain" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white"><Icon name="book" className="h-4 w-4" /></span>
        )}
        <span className="truncate">{site.systemName}</span>
      </Link>
      <nav aria-label="เมนูแอดมิน" className="flex-1 space-y-5 overflow-y-auto p-3">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{g.title}</p>
            {g.items.map((it) => {
              const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] ${active ? "bg-brand-soft font-semibold text-brand" : "text-neutral-700 hover:bg-neutral-100"}`}
                >
                  <Icon name={it.icon} />
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <Link href="/" className="m-3 flex min-h-11 items-center justify-center rounded-lg border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50">
        ดูหน้าเว็บไซต์ →
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EEF1F4]">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-neutral-200 lg:block">{sidebar}</aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="ปิดเมนู" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-slate-600 px-4 text-white">
          <button type="button" aria-label="เปิดเมนู" aria-expanded={open} onClick={() => setOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 lg:hidden">
            <Icon name="menu" />
          </button>
          <label className="relative hidden max-w-sm flex-1 sm:block">
            <span className="sr-only">ค้นหา</span>
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input placeholder="ค้นหา..." className="h-9 w-full rounded-lg bg-white/10 pl-9 pr-3 text-sm placeholder:text-white/60 focus:bg-white/20 focus:outline-none" />
          </label>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-sm leading-tight sm:block">
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs text-white/70">{user.role === "ADMIN" ? "ผู้ดูแลระบบ" : user.role === "LIBRARIAN" ? "บรรณารักษ์" : "ผู้สร้างบทเรียน"}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 font-semibold">{user.name.slice(0, 1) || "A"}</span>
          </div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
