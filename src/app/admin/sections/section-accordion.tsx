"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Ctx = {
  open: Set<string>;
  toggle: (key: string) => void;
  setAll: (open: boolean) => void;
};

const AccordionContext = createContext<Ctx | null>(null);

/** Open/closed state for every section card, plus "expand all / collapse all". */
export function SectionAccordion({ keys, children }: { keys: string[]; children: React.ReactNode }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const setAll = useCallback((value: boolean) => setOpen(value ? new Set(keys) : new Set()), [keys]);

  const allOpen = keys.every((k) => open.has(k));

  return (
    <AccordionContext.Provider value={{ open, toggle, setAll }}>
      <div className="mb-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setAll(!allOpen)}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm hover:bg-neutral-50"
        >
          <Chevron open={!allOpen} double />
          {allOpen ? "ย่อทั้งหมด" : "ขยายทั้งหมด"}
        </button>
      </div>
      {children}
    </AccordionContext.Provider>
  );
}

function Chevron({ open, double = false }: { open: boolean; double?: boolean }) {
  return (
    <svg className={`h-5 w-5 shrink-0 transition-transform ${open ? "" : "rotate-180"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {double ? <path d="M7 13l5 5 5-5M7 6l5 5 5-5" /> : <path d="M6 15l6-6 6 6" />}
    </svg>
  );
}

export function SectionCard({
  sectionKey,
  index,
  kind,
  title,
  badges,
  actions,
  children,
}: {
  sectionKey: string;
  index: number;
  kind: string;
  title: string;
  badges: { label: string; tone: "gray" | "blue" | "amber" }[];
  actions: React.ReactNode; // server-rendered move up/down forms
  children: React.ReactNode;
}) {
  const ctx = useContext(AccordionContext)!;
  const isOpen = ctx.open.has(sectionKey);
  const bodyId = `section-body-${sectionKey}`;
  const tone = { gray: "bg-neutral-100 text-neutral-600", blue: "bg-brand-soft text-brand", amber: "bg-amber-50 text-amber-700" };

  return (
    <li className="rounded-xl bg-white shadow-sm">
      <div className="flex items-center gap-2 p-3 sm:gap-3 sm:p-4">
        <button
          type="button"
          onClick={() => ctx.toggle(sectionKey)}
          aria-expanded={isOpen}
          aria-controls={bodyId}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left hover:bg-neutral-50"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">{index}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{kind}</span>
            <span className="block truncate text-sm text-neutral-500">“{title}”</span>
          </span>
          <span className="hidden flex-wrap justify-end gap-1 sm:flex">
            {badges.map((b) => (
              <span key={b.label} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[b.tone]}`}>{b.label}</span>
            ))}
          </span>
          <Chevron open={isOpen} />
          <span className="sr-only">{isOpen ? "ย่อ" : "ขยาย"}</span>
        </button>
        {actions}
      </div>
      {/* kept mounted while collapsed so unsaved edits and a cropped image are not lost */}
      <div id={bodyId} role="region" aria-label={`ตั้งค่า ${kind}`} hidden={!isOpen} className="border-t border-neutral-100 p-4 sm:p-5">
        {children}
      </div>
    </li>
  );
}
