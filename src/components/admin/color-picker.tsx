"use client";

import { PALETTE } from "@/lib/section-styles";

/** Palette swatches plus a free colour input. Submits the chosen #RRGGBB under `name`. */
export default function ColorPicker({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const current = value.toUpperCase();

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={value} />
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            aria-pressed={current === c}
            onClick={() => onChange(c)}
            className={`h-8 w-full rounded-md border ${current === c ? "ring-2 ring-brand ring-offset-1" : "border-neutral-300"}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} (เลือกเอง)`}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-14 cursor-pointer rounded-md border border-neutral-300 bg-white p-1"
        />
        <span className="text-sm text-neutral-600">{current}</span>
      </div>
    </fieldset>
  );
}
