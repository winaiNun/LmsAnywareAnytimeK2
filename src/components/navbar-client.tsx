"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";

const LINKS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/#media", label: "สื่อการเรียนรู้" },
  { href: "/#courses", label: "คอร์สเรียน" },
  { href: "/#about", label: "เกี่ยวกับ" },
];

type Props = { user: { name: string; isStaff: boolean } | null; name: string; logoUrl: string | null };
type Tab = { href: string; label: string; icon: IconName; id?: string };

/** Which home-page section is on screen, for highlighting the matching bottom tab. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    const visible = new Map<string, number>();
    const targets = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0];
        setActive(best && best[1] > 0 ? best[0] : null);
      },
      { threshold: [0, 0.15, 0.4, 0.7], rootMargin: "-20% 0px -40% 0px" },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return active;
}

export default function NavbarClient({ user, name, logoUrl }: Props) {
  const pathname = usePathname();
  const section = useActiveSection(["media", "courses", "about"]);

  const tabs: Tab[] = [
    { href: "/", label: "หน้าแรก", icon: "home" },
    { href: "/#media", label: "สื่อ", icon: "library", id: "media" },
    { href: "/#courses", label: "คอร์ส", icon: "course", id: "courses" },
    user?.isStaff ? { href: "/admin", label: "จัดการ", icon: "shield" } : { href: "/#about", label: "เกี่ยวกับ", icon: "info", id: "about" },
    user ? { href: "/dashboard", label: "บัญชี", icon: "userCircle" } : { href: "/login", label: "เข้าสู่ระบบ", icon: "login" },
  ];

  const isActive = (t: Tab) => {
    if (t.id) return pathname === "/" && section === t.id;
    if (t.href === "/") return pathname === "/" && section === null;
    return pathname.startsWith(t.href);
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-neutral-200 bg-white/85 shadow-sm shadow-black/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-lg font-bold">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 object-contain" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
                <Icon name="book" className="h-5 w-5" strokeWidth={2} />
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

          {/* desktop account area; on phones this lives in the bottom tab bar */}
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                {user.isStaff && (
                  <Link href="/admin" className="flex min-h-10 items-center gap-2 rounded-full border border-neutral-200 px-4 text-sm font-medium hover:bg-neutral-50">
                    <Icon name="shield" className="h-[18px] w-[18px] text-brand" />
                    จัดการระบบ
                  </Link>
                )}
                <Link href="/dashboard" className="flex min-h-10 items-center gap-2 rounded-full bg-brand-soft px-4 text-sm font-semibold text-brand">
                  <Icon name="userCircle" className="h-5 w-5" />
                  <span className="max-w-[10rem] truncate">{user.name || "บัญชีของฉัน"}</span>
                </Link>
              </>
            ) : (
              <Link href="/login" className="group flex min-h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-sm shadow-brand/30 hover:bg-brand-dark">
                <Icon name="login" className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5" />
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* app-style bottom navigation for phones */}
      <nav
        aria-label="เมนูนำทาง"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-1">
          {tabs.map((t) => {
            const active = isActive(t);
            return (
              <li key={t.label} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${active ? "text-brand" : "text-neutral-500 active:bg-neutral-100"}`}
                >
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-brand-soft" : ""}`}>
                    <Icon name={t.icon} className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.7} />
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
