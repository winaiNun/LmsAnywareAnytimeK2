"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import SitePageBody from "@/components/site-page-body";
import { saveFaq, type FaqFormState } from "./actions";

export type FaqValues = { id?: string; question: string; answer: string; keywords: string; pinned: boolean; active: boolean };

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : children}</button>;
}

/** Add (no id) or edit one Q&A. `fromUnanswered` = the "ตอบไม่ได้" row this answer is written for. */
export default function FaqForm({ values, fromUnanswered }: { values: FaqValues; fromUnanswered?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const isNew = !values.id;
  const [state, action] = useFormState<FaqFormState, FormData>(saveFaq.bind(null, values.id ?? null), undefined);
  const [answer, setAnswer] = useState(values.answer);

  // after a save: refresh the list; a new item clears the form (the "added" message stays), and an answer written
  // for an unanswered question goes back to that list so the next one is one click away
  useEffect(() => {
    if (!state?.saved) return;
    if (isNew) {
      formRef.current?.reset();
      setAnswer("");
      if (fromUnanswered) router.replace("/admin/faq?tab=unanswered");
    }
    router.refresh();
  }, [state, router, isNew, fromUnanswered]);

  return (
    <form ref={formRef} action={action} key={`${values.id ?? "new"}-${fromUnanswered ?? ""}`} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{isNew ? "เพิ่มคำถาม-คำตอบ" : "แก้ไขคำถาม-คำตอบ"}</h2>
      {fromUnanswered && <input type="hidden" name="fromUnanswered" value={fromUnanswered} />}
      <label className="block space-y-1">
        <span className="text-sm font-medium">คำถาม *</span>
        <input name="question" required maxLength={200} defaultValue={values.question} placeholder="เช่น ลืมรหัสผ่านต้องทำอย่างไร" className={input} />
      </label>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">คำตอบ * <span className="font-normal text-neutral-500">({answer.length}/1000)</span></span>
          <textarea name="answer" required rows={7} maxLength={1000} value={answer} onChange={(e) => setAnswer(e.target.value)} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2" />
          <span className="block text-xs text-neutral-500">เว้นบรรทัดว่าง = ย่อหน้าใหม่ · ขึ้นต้น “- ” = รายการ · ลิงก์: [ข้อความ](/courses) หรือ [ข้อความ](https://...)</span>
        </label>
        <div className="space-y-1">
          <span className="text-sm font-medium">ตัวอย่างที่ผู้ใช้เห็น</span>
          <div className="min-h-[9rem] rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-neutral-800">
            {answer.trim() ? <SitePageBody body={answer} compact /> : <p className="text-sm text-neutral-400">พิมพ์คำตอบเพื่อดูตัวอย่าง</p>}
          </div>
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">คำที่ผู้ใช้มักพิมพ์ (ช่วยให้จับคำถามได้แม่นขึ้น)</span>
        <input name="keywords" maxLength={300} defaultValue={values.keywords} placeholder="คั่นด้วยเครื่องหมายจุลภาค เช่น ลืมรหัส, รีเซ็ตรหัสผ่าน, เข้าสู่ระบบไม่ได้" className={input} />
        <span className="block text-xs text-neutral-500">ใส่คำพ้อง คำสะกดต่างๆ หรือประโยคสั้นๆ ที่คนมักถาม คั่นแต่ละคำ/วลีด้วย , (คอมมา)</span>
      </label>
      <div className="flex flex-wrap gap-x-6">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={values.active} className="h-4 w-4" /> แสดงในแชต</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="pinned" defaultChecked={values.pinned} className="h-4 w-4" /> ปักหมุดเป็นปุ่มคำถามเริ่มต้น (แนะนำไม่เกิน 6 ข้อ)</label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">{isNew ? "เพิ่มแล้ว — ดูในรายการด้านล่าง" : "บันทึกแล้ว"}</p>}
      <div className="flex flex-wrap gap-2">
        <Submit>{isNew ? "เพิ่มรายการ" : "บันทึก"}</Submit>
        {(!isNew || fromUnanswered) && <a href="/admin/faq" className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-5 text-sm">{isNew ? "ยกเลิก" : "เลิกแก้ไข"}</a>}
      </div>
    </form>
  );
}
