/** Browser side of the error log: send one small report to /api/log-error. Never throws, never blocks the page. */
export function reportClientError(r: { source: "client" | "boundary"; message: string; stack?: string; digest?: string }) {
  try {
    const body = JSON.stringify({ ...r, path: location.pathname });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      if (navigator.sendBeacon("/api/log-error", new Blob([body], { type: "application/json" }))) return;
    }
    void fetch("/api/log-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    /* reporting must never break the page */
  }
}
