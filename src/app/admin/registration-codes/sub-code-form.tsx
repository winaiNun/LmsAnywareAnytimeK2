"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { MAX_SUBCODES_PER_RUN } from "@/lib/registration-limits";
import { createSubCodes, type CodeFormState } from "./actions";

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

function Submit() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังสร้าง..." : "สร้างรหัสย่อย"}</button>;
}

/** One sub-code per school under this group code: all schools, one district, or one network centre. Schools that already have one are skipped. */
export default function SubCodeForm({ parentId, districts, centers }: { parentId: string; districts: string[]; centers: string[] }) {
  const [state, action] = useFormState<CodeFormState, FormData>(createSubCodes.bind(null, parentId), undefined);
  const [scope, setScope] = useState<"all" | "district" | "center">("all");
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-semibold">สร้างรหัสย่อยให้โรงเรียน</h2>
        <p className="text-sm text-neutral-500">สร้างรหัสย่อย 1 รหัสต่อ 1 โรงเรียน ล็อกโรงเรียนให้เอง ใช้ประเภทสมาชิกและวันหมดอายุของรหัสกลุ่ม · ดูยอดสมัครรายโรงเรียนได้จากรายการด้านล่าง · ปิดรหัสกลุ่ม = ปิดทุกรหัสย่อย · โรงเรียนที่มีรหัสย่อยอยู่แล้วจะถูกข้าม · ครั้งละไม่เกิน {MAX_SUBCODES_PER_RUN} รหัส</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1"><span className="text-sm font-medium">สร้างให้</span>
          <select name="scope" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className={input}>
            <option value="all">ทุกโรงเรียนในเขต</option>
            <option value="district">โรงเรียนในอำเภอ…</option>
            <option value="center">โรงเรียนในศูนย์เครือข่าย…</option>
          </select>
        </label>
        {scope !== "all" && (
          <label className="block space-y-1"><span className="text-sm font-medium">{scope === "district" ? "อำเภอ" : "ศูนย์เครือข่าย"}</span>
            <select name="value" required className={input} defaultValue="">
              <option value="" disabled>เลือก…</option>
              {(scope === "district" ? districts : centers).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
        <label className="block space-y-1"><span className="text-sm font-medium">ใช้ได้กี่ครั้งต่อรหัสย่อย (ว่าง = ไม่จำกัด)</span><input name="maxUses" inputMode="numeric" pattern="[0-9]*" className={input} /></label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && !state.error && <p role="status" className="text-sm text-green-700">สร้างรหัสย่อยแล้ว — ดูในรายการด้านล่าง</p>}
      <Submit />
    </form>
  );
}
