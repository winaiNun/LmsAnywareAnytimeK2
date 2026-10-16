"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Glyph from "@/components/glyph";
import { MAX_STAT_LABEL, STAT_ICON_KEYS, STAT_METRICS, STAT_METRIC_KEYS, formatStat, isStatMetric, type StatMetric } from "@/lib/stats/metrics";
import { saveStatCard, type StatFormState } from "./actions";

export type CardValues = { id?: string; metric: StatMetric; label: string; icon: string; visible: boolean };

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : children}</button>;
}

/** Add (no id) or edit one stat card: which number, its wording, its icon. `current` = what each number is right now. */
export default function CardForm({ values, current, full }: { values: CardValues; current: Record<string, number>; full: boolean }) {
  const router = useRouter();
  const isNew = !values.id;
  const [nonce, setNonce] = useState(0);
  const [metric, setMetric] = useState<StatMetric>(values.metric);
  const [icon, setIcon] = useState(values.icon);
  const [state, action] = useFormState<StatFormState, FormData>(saveStatCard.bind(null, values.id ?? null), undefined);
  const m = STAT_METRICS[metric];

  useEffect(() => {
    if (!state?.saved) return;
    if (isNew) {
      setNonce((n) => n + 1);
      setIcon("");
    }
    router.refresh();
  }, [state, router, isNew]);

  return (
    <form action={action} key={`${values.id ?? "new"}-${nonce}`} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{isNew ? "เพิ่มการ์ดตัวเลข" : "แก้ไขการ์ดตัวเลข"}</h2>
      {isNew && full && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">มีการ์ดครบ 8 ใบแล้ว — ลบใบที่ไม่ใช้ก่อนจึงจะเพิ่มได้</p>}

      <label className="block space-y-1">
        <span className="text-sm font-medium">ตัวเลขที่จะแสดง *</span>
        <select name="metric" value={metric} onChange={(e) => isStatMetric(e.target.value) && setMetric(e.target.value)} className={input}>
          {STAT_METRIC_KEYS.map((k) => <option key={k} value={k}>{STAT_METRICS[k].label} — ตอนนี้ {formatStat(current[k])}</option>)}
        </select>
        <span className="block text-xs text-neutral-500">นับอะไร: {m.about}</span>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">ข้อความบนการ์ด (ว่าง = ใช้ “{m.label}”)</span>
        <input name="label" maxLength={MAX_STAT_LABEL} defaultValue={values.label} placeholder={m.label} className={input} />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">ไอคอน</legend>
        <input type="hidden" name="icon" value={icon} />
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={icon === ""} onClick={() => setIcon("")} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm ${icon === "" ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}>
            <Glyph name={m.icon} size={20} />ค่าเริ่มต้น
          </button>
          {STAT_ICON_KEYS.map((k) => (
            <button key={k} type="button" aria-label={`ไอคอน ${k}`} aria-pressed={icon === k} onClick={() => setIcon(k)} className={`flex h-11 w-11 items-center justify-center rounded-xl border ${icon === k ? "border-brand bg-brand-soft text-brand" : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}>
              <Glyph name={k} size={20} />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="visible" defaultChecked={values.visible} className="h-4 w-4" /> แสดงบนหน้าแรก</label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">{isNew ? "เพิ่มแล้ว — ดูในตัวอย่างและรายการด้านล่าง" : "บันทึกแล้ว"}</p>}
      <div className="flex flex-wrap gap-2">
        <Submit>{isNew ? "เพิ่มการ์ด" : "บันทึก"}</Submit>
        {!isNew && <a href="/admin/stat-cards" className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-5 text-sm">เลิกแก้ไข</a>}
      </div>
    </form>
  );
}
