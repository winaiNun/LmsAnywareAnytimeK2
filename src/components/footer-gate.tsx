"use client";

import { usePathname } from "next/navigation";

const HIDDEN = ["/admin", "/login", "/register", "/offline"];

/** The footer belongs to the public pages: the back office, sign-in and sign-up screens have their own layout. */
export default function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return <>{children}</>;
}
