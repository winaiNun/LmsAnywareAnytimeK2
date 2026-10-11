"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Search + filters that react as you type (a "data table" feel): no search button.
 * Text boxes update the results ~250 ms after you stop typing (and not in the middle of Thai IME composition);
 * selects / checkboxes update at once. The URL is kept in sync (shareable, back button works) and the results,
 * which stay server-rendered, dim slightly while the new ones load. Pressing Enter still works.
 *
 * `fields` = the inputs (any element with a `name` inside the form), `children` = the results area.
 */
export default function LiveFilter({
  action,
  fields,
  children,
  omit = {},
  className = "",
  formClassName = "",
}: {
  action: string;
  fields: React.ReactNode;
  children: React.ReactNode;
  /** params that equal these defaults are left out of the URL, e.g. { sort: "latest" } */
  omit?: Record<string, string>;
  className?: string;
  formClassName?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const composing = useRef(false);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (!pending) setBusy(false); }, [pending]);

  function push() {
    const form = formRef.current;
    if (!form) return;
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(form)) {
      const value = typeof v === "string" ? v.trim() : "";
      if (value && omit[k] !== value) p.set(k, value);
    }
    const url = `${action}${p.toString() ? `?${p}` : ""}`;
    setBusy(true);
    start(() => router.replace(url, { scroll: false }));
  }

  const later = () => { clearTimeout(timer.current); timer.current = setTimeout(push, 250); };

  return (
    <div className={className}>
      <form
        ref={formRef}
        action={action}
        method="get"
        role="search"
        onSubmit={(e) => { e.preventDefault(); clearTimeout(timer.current); push(); }}
        onInput={(e) => {
          const t = e.target as HTMLElement;
          if (t instanceof HTMLInputElement && ["text", "search"].includes(t.type)) { if (!composing.current) later(); }
        }}
        onChange={(e) => {
          const t = e.target as HTMLElement;
          if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && !["text", "search"].includes(t.type))) { clearTimeout(timer.current); push(); }
        }}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; later(); }}
        className={`relative ${formClassName}`}
      >
        {fields}
        {/* a hidden submit so Enter works in every browser */}
        <button type="submit" className="sr-only" tabIndex={-1}>ค้นหา</button>
        <span className={`pointer-events-none absolute inset-x-3 bottom-0 h-0.5 overflow-hidden rounded-full transition-opacity ${busy ? "opacity-100" : "opacity-0"}`} aria-hidden>
          <span className="block h-full w-1/3 animate-[livebar_1s_ease-in-out_infinite] rounded-full bg-brand" />
        </span>
      </form>
      <div aria-busy={busy} className={`transition-opacity duration-150 ${busy ? "opacity-60" : "opacity-100"}`}>{children}</div>
    </div>
  );
}
