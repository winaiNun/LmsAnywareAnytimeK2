"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Asks the server to count this browser once per day (the server decides by cookie whether today already counted).
 * Renders nothing and does nothing in the back office. Nothing else is sent while the page stays open.
 */
export default function VisitBeacon() {
  const pathname = usePathname();
  const skip = pathname.startsWith("/admin");

  useEffect(() => {
    if (skip) return;
    try {
      if (sessionStorage.getItem("lms.visit") === new Date().toDateString()) return;
      sessionStorage.setItem("lms.visit", new Date().toDateString());
    } catch {}
    fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => {});
  }, [skip]);

  return null;
}
