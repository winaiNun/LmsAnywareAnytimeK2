"use client";

import { useEffect, useState } from "react";

/** "Online now" number: fetched on load and refreshed every minute while the tab is visible. */
export default function OnlineCount() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/online").then((r) => r.json()).then((d: { online: number | null }) => { if (alive && typeof d.online === "number") setN(Math.max(1, d.online)); }).catch(() => {});
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return <span className="tabular-nums">{n === null ? "…" : new Intl.NumberFormat("th-TH").format(n)}</span>;
}
