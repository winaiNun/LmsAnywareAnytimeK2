"use client";

import { useState } from "react";
import { PREFIX_GROUPS, PREFIXES } from "@/lib/members";

const OTHER = "__other";

/**
 * Title (คำนำหน้า) picker: a grouped list of the usual titles (general, academic, military, police, religious) plus
 * "อื่นๆ (พิมพ์เอง)" for anything else. Submits the final text as the field `prefix`. Renders two grid children
 * (the list, and the free-text box when "อื่นๆ" is chosen, spanning the full row) so it works in any grid.
 */
export default function PrefixField({ defaultValue = "", className, labelClassName = "block space-y-1", titleClassName = "text-sm font-medium" }: { defaultValue?: string; className: string; labelClassName?: string; titleClassName?: string }) {
  const known = !defaultValue || PREFIXES.includes(defaultValue);
  const [choice, setChoice] = useState(known ? defaultValue : OTHER);
  const [custom, setCustom] = useState(known ? "" : defaultValue);
  const value = choice === OTHER ? custom.trim() : choice;

  return (
    <>
      <label className={labelClassName}>
        <span className={titleClassName}>คำนำหน้า</span>
        <input type="hidden" name="prefix" value={value} />
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className={className} aria-label="คำนำหน้า">
          <option value="">-</option>
          {PREFIX_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((i) => <option key={i.value} value={i.value}>{i.value}</option>)}
            </optgroup>
          ))}
          <option value={OTHER}>อื่นๆ (พิมพ์เอง)</option>
        </select>
      </label>
      {choice === OTHER && (
        <label className={`${labelClassName} order-last col-span-full`}>
          <span className={titleClassName}>พิมพ์คำนำหน้า / ยศ</span>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={30} autoFocus placeholder="เช่น ว่าที่ร.ต.หญิง, พระครูสมุห์, ม.ล." autoCapitalize="none" className={className} />
          <span className="block text-xs opacity-70">จะแสดงติดกับชื่อ เช่น “{custom.trim() || "ยศ"}วินัย หนุนกระโทก”</span>
        </label>
      )}
    </>
  );
}
