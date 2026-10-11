"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import ThaiDateField from "@/components/thai-date-field";
import { resetPage, saveFooterSettings, savePage, type PagesFormState } from "./actions";

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : children}</button>;
}

export type FooterValues = {
  contactAddress: string; contactPhone: string; contactEmail: string; facebookUrl: string; youtubeUrl: string; lineUrl: string;
  counterBase: number; counterSince: string; showVisits: boolean;
};

export function FooterSettingsForm({ v }: { v: FooterValues }) {
  const [state, action] = useFormState<PagesFormState, FormData>(saveFooterSettings, undefined);
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-semibold">ช่องทางติดต่อและท้ายเว็บ</h2>
        <p className="text-sm text-neutral-500">แสดงใน footer และหน้า “ติดต่อเรา” (เว้นว่างช่องที่ไม่ใช้) · ลิงก์โซเชียลต้องเป็น https</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2"><span className="text-sm font-medium">ที่อยู่</span><textarea name="contactAddress" rows={2} maxLength={300} defaultValue={v.contactAddress} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2" /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">โทรศัพท์</span><input name="contactPhone" type="tel" maxLength={40} defaultValue={v.contactPhone} className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">อีเมลติดต่อ</span><input name="contactEmail" type="email" maxLength={120} defaultValue={v.contactEmail} className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">Facebook</span><input name="facebookUrl" inputMode="url" autoCapitalize="none" placeholder="https://www.facebook.com/…" defaultValue={v.facebookUrl} className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">YouTube</span><input name="youtubeUrl" inputMode="url" autoCapitalize="none" placeholder="https://www.youtube.com/@…" defaultValue={v.youtubeUrl} className={input} /></label>
        <label className="block space-y-1 sm:col-span-2"><span className="text-sm font-medium">LINE (ลิงก์ที่เปิดแชต/โอเพนแชต)</span><input name="lineUrl" inputMode="url" autoCapitalize="none" placeholder="https://line.me/ti/p/…" defaultValue={v.lineUrl} className={input} /></label>
      </div>

      <div className="space-y-3 border-t border-neutral-100 pt-4">
        <h3 className="font-medium">ตัวนับผู้เข้าชม</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ThaiDateField name="counterSince" label="เริ่มนับตั้งแต่ (วันที่แสดงใน footer)" defaultValue={v.counterSince} />
          <label className="block space-y-1"><span className="text-sm font-medium">ตัวเลขตั้งต้นของยอดรวม</span><input name="counterBase" inputMode="numeric" defaultValue={v.counterBase} className={input} /><span className="block text-xs text-neutral-500">ใส่ถ้าต้องการยกยอดจากเว็บเก่า (ปกติ 0)</span></label>
        </div>
        <label className="flex min-h-11 items-start gap-2"><input type="checkbox" name="showVisits" defaultChecked={v.showVisits} className="mt-1 h-4 w-4" /><span>นับและแสดงจำนวนผู้เข้าชม (วันนี้ / เดือนนี้ / ทั้งหมด)<span className="block text-xs text-neutral-500">นับผู้เข้าชมไม่ซ้ำรายวันด้วยคุกกี้ ไม่เก็บข้อมูลที่ระบุตัวตนได้</span></span></label>
      </div>

      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">บันทึกแล้ว</p>}
      <Submit>บันทึก</Submit>
    </form>
  );
}

export type PageValues = { slug: string; label: string; path: string; title: string; body: string; custom: boolean };

export function PageEditor({ pages }: { pages: PageValues[] }) {
  const [slug, setSlug] = useState(pages[0].slug);
  const p = pages.find((x) => x.slug === slug)!;
  const [state, action] = useFormState<PagesFormState, FormData>(savePage.bind(null, slug), undefined);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-semibold">เนื้อหาหน้าข้อมูล</h2>
        <p className="text-sm text-neutral-500">เลือกหน้า แล้วแก้หัวข้อ/เนื้อหา · ถ้าไม่เคยแก้ ระบบใช้ข้อความเริ่มต้น (นโยบายความเป็นส่วนตัวและเงื่อนไขเป็นฉบับร่าง ควรให้ผู้รับผิดชอบตรวจก่อนใช้จริง)</p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="เลือกหน้า">
        {pages.map((x) => (
          <button key={x.slug} type="button" role="tab" aria-selected={x.slug === slug} onClick={() => { setSlug(x.slug); setMsg(""); }} className={`min-h-10 rounded-full border px-4 text-sm ${x.slug === slug ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>
            {x.label}{x.custom && <span className="ml-1 text-xs text-green-700">· แก้แล้ว</span>}
          </button>
        ))}
      </div>
      <form action={action} key={slug} className="space-y-3">
        <label className="block space-y-1"><span className="text-sm font-medium">หัวข้อ</span><input name="title" required maxLength={100} defaultValue={p.title} className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">เนื้อหา</span>
          <textarea name="body" required rows={16} maxLength={20000} defaultValue={p.body} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm leading-relaxed" />
        </label>
        <p className="text-xs text-neutral-500">รูปแบบ: เว้นบรรทัด = ย่อหน้าใหม่ · <code>## หัวข้อ</code> · <code>- รายการ</code> · <code>[ข้อความ](https://…)</code> หรือ <code>[ข้อความ](/library)</code> · ไม่รองรับ HTML</p>
        {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        {state?.saved && <p role="status" className="text-sm text-green-700">บันทึกแล้ว</p>}
        {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
        <div className="flex flex-wrap gap-2">
          <Submit>บันทึกหน้านี้</Submit>
          <a href={p.path} target="_blank" rel="noopener" className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-5 text-sm">เปิดดูหน้านี้</a>
          {p.custom && (
            <button type="button" disabled={pending} onClick={() => { if (confirm("กลับไปใช้ข้อความเริ่มต้นของหน้านี้? ข้อความที่แก้ไว้จะหายไป")) start(async () => { const r = await resetPage(slug); if (r.error) setMsg(r.error); else window.location.reload(); }); }} className="min-h-11 rounded-lg border border-red-200 px-5 text-sm text-red-600">ใช้ข้อความเริ่มต้น</button>
          )}
        </div>
      </form>
    </section>
  );
}
