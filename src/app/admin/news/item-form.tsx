"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import ThaiDateField from "@/components/thai-date-field";
import { formatThaiDate } from "@/lib/thai-date";
import { saveItem, testFeed, type FeedTest, type NewsFormState } from "./actions";

export type ItemValues = {
  id?: string;
  tabId: string;
  kind: "LINK" | "FEED";
  title: string;
  url: string;
  note: string;
  publishedAt: string; // ISO or ""
  pinned: boolean;
  active: boolean;
  feedLimit: number;
  feedCacheMin: number;
};

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";
const CACHE_CHOICES = [
  [15, "15 นาที (ข่าวสดมาก)"],
  [30, "30 นาที"],
  [60, "1 ชั่วโมง (แนะนำ)"],
  [180, "3 ชั่วโมง"],
  [360, "6 ชั่วโมง (ข่าวไม่ค่อยเปลี่ยน)"],
] as const;

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : children}</button>;
}

/** Add (no id) or edit one news item: a typed link, or an RSS/Atom source. The kind is picked when adding and fixed afterwards. */
export default function ItemForm({ values, tabs }: { values: ItemValues; tabs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [nonce, setNonce] = useState(0);
  const isNew = !values.id;
  const [kind, setKind] = useState(values.kind);
  const [url, setUrl] = useState(values.url);
  const [test, setTest] = useState<FeedTest | "busy" | null>(null);
  const [state, action] = useFormState<NewsFormState, FormData>(saveItem.bind(null, values.id ?? null), undefined);

  useEffect(() => {
    if (!state?.saved) return;
    if (isNew) {
      setNonce((n) => n + 1);
      setUrl("");
      setTest(null);
    }
    router.refresh();
  }, [state, router, isNew]);

  async function runTest() {
    setTest("busy");
    try {
      setTest(await testFeed(url));
    } catch {
      setTest({ ok: false, error: "ทดสอบไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  return (
    <form action={action} key={`${values.id ?? "new"}-${nonce}`} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{isNew ? "เพิ่มรายการข่าว" : "แก้ไขรายการข่าว"}</h2>
      <input type="hidden" name="kind" value={kind} />

      {isNew && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">ชนิดรายการ</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {([["LINK", "หัวข้อ + ลิงก์ภายนอก", "พิมพ์หัวข้อข่าวและลิงก์เอง เปิดในแท็บใหม่"], ["FEED", "RSS / Atom feed", "ดึงข่าวล่าสุดจากเว็บอื่นให้อัตโนมัติ"]] as const).map(([k, label, hint]) => (
              <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${kind === k ? "border-brand bg-brand-soft" : "border-neutral-300"}`}>
                <input type="radio" name="kindChoice" checked={kind === k} onChange={() => { setKind(k); setTest(null); }} className="mt-1 h-4 w-4" />
                <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-neutral-500">{hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium">แถบหัวข้อที่จะแสดง *</span>
        <select name="tabId" required defaultValue={values.tabId} className={input}>
          <option value="">เลือกแถบหัวข้อ</option>
          {tabs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>

      {kind === "LINK" ? (
        <div className="space-y-4">
          <label className="block space-y-1"><span className="text-sm font-medium">หัวข้อข่าว *</span><input name="title" required maxLength={200} defaultValue={values.title} placeholder="เช่น ประกาศรับสมัครครูอัตราจ้าง ปีการศึกษา 2569" className={input} /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">ลิงก์ * (เปิดในแท็บใหม่)</span><input name="url" required inputMode="url" autoCapitalize="none" spellCheck={false} defaultValue={values.url} placeholder="https://…" className={input} /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">หมายเหตุสั้นๆ (ไม่บังคับ ไม่เกิน 160 ตัวอักษร)</span><input name="note" maxLength={160} defaultValue={values.note} placeholder="เช่น ที่มา: สำนักงาน ก.ค.ศ." className={input} /></label>
          <ThaiDateField name="publishedAt" label="วันที่ของข่าว (พ.ศ. — ว่าง = วันที่เพิ่มรายการ)" defaultValue={values.publishedAt} />
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="pinned" defaultChecked={values.pinned} className="h-4 w-4" /> ปักหมุดไว้บนสุดของแถบ</label>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block space-y-1"><span className="text-sm font-medium">ชื่อแหล่งข่าว * (แสดงบนทุกข่าวจากแหล่งนี้)</span><input name="title" required maxLength={80} defaultValue={values.title} placeholder="เช่น สพฐ. / กระทรวงศึกษาธิการ" className={input} /></label>
          <div className="space-y-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium">ลิงก์ฟีด RSS/Atom *</span>
              <input name="url" required inputMode="url" autoCapitalize="none" spellCheck={false} value={url} onChange={(e) => { setUrl(e.target.value); setTest(null); }} placeholder="https://example.go.th/feed" className={input} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={runTest} disabled={!url.trim() || test === "busy"} className="min-h-10 rounded-lg border border-brand px-4 text-sm font-medium text-brand disabled:opacity-40">{test === "busy" ? "กำลังทดสอบ..." : "ทดสอบฟีด"}</button>
              <span className="text-xs text-neutral-500">ดึงมาลองหนึ่งครั้งเพื่อตรวจว่าเป็นฟีดจริง (ยังไม่บันทึก)</span>
            </div>
            {test && test !== "busy" && (
              test.ok ? (
                <div role="status" className="space-y-1 rounded-xl bg-green-50 p-3 text-sm text-green-900">
                  <p className="font-semibold">ใช้ได้ — {test.title || "ฟีดไม่มีชื่อ"} · พบ {test.count} ข่าว</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs">
                    {test.sample.map((s, i) => <li key={i}>{s.title} <span className="text-green-800/70">· {s.date ? formatThaiDate(new Date(s.date)) : "ไม่มีวันที่"}{s.hasImage ? " · มีรูป" : ""}</span></li>)}
                  </ul>
                </div>
              ) : (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{test.error}</p>
              )
            )}
            <p className="text-xs text-neutral-500">เว็บส่วนใหญ่ใช้ลิงก์ลงท้าย /feed, /rss หรือ /rss.xml · ถ้าเว็บนั้นไม่มี RSS ให้เพิ่มเป็น “หัวข้อ + ลิงก์ภายนอก” แทน</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1"><span className="text-sm font-medium">ดึงข่าวล่าสุดกี่ข่าว (5–50)</span><input name="feedLimit" type="number" inputMode="numeric" min={5} max={50} required defaultValue={values.feedLimit} className={input} /></label>
            <label className="block space-y-1"><span className="text-sm font-medium">ดึงข่าวใหม่ทุก</span>
              <select name="feedCacheMin" defaultValue={values.feedCacheMin} className={input}>{CACHE_CHOICES.map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select>
            </label>
          </div>
          <p className="text-xs text-neutral-500">ระบบเก็บสำเนาข่าวชั่วคราวตามรอบที่เลือก จึงไม่ยิงเว็บต้นทางทุกครั้งที่มีคนเข้า และไม่เก็บข่าวลงฐานข้อมูล</p>
        </div>
      )}

      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={values.active} className="h-4 w-4" /> แสดงบนเว็บไซต์</label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">{isNew ? "เพิ่มแล้ว — ดูในรายการด้านล่าง" : "บันทึกแล้ว"}</p>}
      <div className="flex flex-wrap gap-2">
        <Submit>{isNew ? "เพิ่มรายการ" : "บันทึก"}</Submit>
        {!isNew && <a href="/admin/news" className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-5 text-sm">เลิกแก้ไข</a>}
      </div>
    </form>
  );
}
