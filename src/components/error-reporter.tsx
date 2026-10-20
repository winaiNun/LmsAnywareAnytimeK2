"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client";

const MAX_PER_PAGE_LOAD = 5; // a loop must not flood the log
// browser noise that is not a bug of ours
const IGNORE = /ResizeObserver loop|Script error|Non-Error promise rejection|AbortError|The operation was aborted|Load failed|NetworkError|Failed to fetch/i;

/** Reports uncaught errors and unhandled promise rejections of this page (once each kind per page load, capped). */
export default function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const seen = new Set<string>();
    const send = (message: string, stack?: string) => {
      if (!message || IGNORE.test(message) || sent >= MAX_PER_PAGE_LOAD || seen.has(message)) return;
      seen.add(message);
      sent++;
      reportClientError({ source: "client", message, stack });
    };
    const onError = (e: ErrorEvent) => send(e.message || String(e.error), e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      send(r instanceof Error ? r.message : typeof r === "string" ? r : "", r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
