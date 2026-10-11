"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AvatarData } from "@/lib/avatar";
import { plainText } from "@/lib/site-texts";
import Avatar from "./avatar";
import NavDrawer, { type DrawerArea } from "./nav-drawer";
import UserMenu from "./user-menu";
import { Icon, type IconName } from "./icons";

const LINKS = [
  { href: "/", key: "nav.home" },
  { href: "/library", key: "nav.library" },
  { href: "/#courses", key: "nav.courses" },
  { href: "/schools", key: "nav.schools" },
  { href: "/about", key: "nav.about" },
];

type Props = { user: { name: string; isStaff: boolean; canReview: boolean; canTeach: boolean; typeLabel: string; avatar: AvatarData | null } | null; name: string; areaName?: string; logoUrl: string | null; areas: DrawerArea[]; texts: Record<string, string> };
type Tab = { href: string; label: string; icon: IconName; id?: string; avatar?: boolean };

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

export default function NavbarClient({ user, name, areaName, logoUrl, areas, texts }: Props) {
  const pathname = usePathname();
  const section = useActiveSection(["courses"]);

  const tabs: Tab[] = [
    { href: "/", label: plainText(texts["tab.home"]), icon: "home" },
    { href: "/library", label: plainText(texts["tab.library"]), icon: "library" },
    { href: "/#courses", label: plainText(texts["tab.courses"]), icon: "course", id: "courses" },
    user?.isStaff ? { href: "/admin", label: "จัดการ", icon: "shield" } : { href: "/schools", label: plainText(texts["tab.schools"]), icon: "school" },
    user ? { href: "/dashboard", label: "บัญชี", icon: "userCircle", avatar: true } : { href: "/login", label: "เข้าสู่ระบบ", icon: "login" },
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
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate">{name}</span>
              {areaName && <span className="truncate whitespace-nowrap text-[11px] font-normal text-neutral-500">{areaName}</span>}
            </span>
          </Link>

          <nav aria-label="เมนูหลัก" className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => {
              const current = l.href === "/" ? pathname === "/" : !l.href.includes("#") && pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={current ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-[15px] transition-colors ${current ? "bg-brand-soft font-semibold text-brand" : "text-neutral-700 hover:bg-brand-soft hover:text-brand"}`}
                >
                  {plainText(texts[l.key])}
                </Link>
              );
            })}
          </nav>

          {/* phones: the hamburger holds everything the bottom tabs do not */}
          <NavDrawer user={user} areas={areas} aboutLabel={plainText(texts["nav.about"])} />

          {/* desktop account area; on phones this lives in the bottom tab bar */}
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <UserMenu user={user} />
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
                    {t.avatar && user ? (
                      <Avatar avatar={user.avatar} name={user.name || "?"} size={26} className={active ? "ring-2 ring-brand" : "ring-1 ring-neutral-300"} />
                    ) : (
                      <Icon name={t.icon} className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.7} />
                    )}
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
