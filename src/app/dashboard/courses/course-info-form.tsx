"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import CoverField, { type CoverValue } from "@/components/cover-field";
import { Spinner } from "@/components/icons";
import { saveCourseInfo } from "./actions";
import { MEMBER_TYPES, MEMBER_TYPE_LABEL } from "@/lib/members";

type Option = { id: string; name: string };
export type CourseInfoValues = {
  id?: string;
  title: string;
  description: string;
  areaId: string;
  levelIds: string[];
  instructorName: string;
  hours: string;
  enrollOpen: boolean;
  audienceTypes: string[];
  audienceOnly: boolean;
  coverUrl: string | null;
  coverDrive: string;
  coverFx: number;
  coverFy: number;
};

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

/** Basic information + cover of a course. A new course goes straight to its content tab after the first save. */
export default function CourseInfoForm({ values, areas, levels, allowUpload }: { values: CourseInfoValues; areas: Option[]; levels: Option[]; allowUpload: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(values.title);
  const [description, setDescription] = useState(values.description);
  const [areaId, setAreaId] = useState(values.areaId);
  const [levelIds, setLevelIds] = useState(values.levelIds);
  const [instructorName, setInstructorName] = useState(values.instructorName);
  const [hours, setHours] = useState(values.hours);
  const [enrollOpen, setEnrollOpen] = useState(values.enrollOpen);
  const [audienceTypes, setAudienceTypes] = useState(values.audienceTypes);
  const [audienceOnly, setAudienceOnly] = useState(values.audienceOnly);
  const [cover, setCover] = useState<CoverValue>({ mode: "keep", fx: values.coverFx, fy: values.coverFy });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const fd = new FormData(formRef.current ?? undefined);
    const h = hours.trim() ? Number(hours.replace(",", ".")) : null;
    if (h !== null && !Number.isFinite(h)) return setError("จำนวนชั่วโมงต้องเป็นตัวเลข");
    fd.set("payload", JSON.stringify({ title, description, areaId, levelIds, instructorName, hours: h, enrollOpen, audienceTypes, audienceOnly: audienceOnly && audienceTypes.length > 0, cover }));
    start(async () => {
      const r = await saveCourseInfo(values.id ?? null, fd);
      if ("error" in r && r.error) { setError(r.error); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (!values.id && "id" in r) { router.push(`/dashboard/courses/${r.id}/edit?tab=content&created=1`); return; }
      setSaved(true);
      router.refresh();
    });
  }

  const toggle = (id: string) => setLevelIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const label = "block space-y-1";

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-5">
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {saved && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">บันทึกแล้ว</p>}

      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">ข้อมูลคอร์ส</h2>
        <label className={label}><span className="text-sm font-medium">ชื่อคอร์ส *</span><input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} className={input} /></label>
        <label className={label}><span className="text-sm font-medium">คำอธิบายคอร์ส *</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={3000} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2" placeholder="เรียนแล้วได้อะไร เหมาะกับใคร ต้องเตรียมอะไร" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}><span className="text-sm font-medium">กลุ่มสาระ *</span>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} required className={input}>
              <option value="">เลือกกลุ่มสาระ</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className={label}><span className="text-sm font-medium">จำนวนชั่วโมงเรียนโดยประมาณ</span><input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="เช่น 3 หรือ 1.5" className={input} /></label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">ระดับชั้น (เลือกได้หลายระดับ)</legend>
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => (
              <label key={l.id} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm ${levelIds.includes(l.id) ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>
                <input type="checkbox" checked={levelIds.includes(l.id)} onChange={() => toggle(l.id)} className="sr-only" />{l.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={label}><span className="text-sm font-medium">ชื่อผู้สอน (ที่แสดงบนหน้าคอร์ส)</span><input value={instructorName} onChange={(e) => setInstructorName(e.target.value)} maxLength={100} placeholder="เช่น นางสมศรี ใจดี — เว้นว่างจะใช้ชื่อของคุณ" className={input} /></label>
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={enrollOpen} onChange={(e) => setEnrollOpen(e.target.checked)} className="h-5 w-5" /><span>เปิดรับลงทะเบียนเรียน<span className="block text-xs text-neutral-500">ปิดได้ภายหลัง ผู้ที่ลงทะเบียนแล้วยังเรียนต่อได้</span></span></label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">กลุ่มเป้าหมายของคอร์ส <span className="font-normal text-neutral-500">(ไม่เลือก = เหมาะกับทุกคน)</span></legend>
          <div className="flex flex-wrap gap-2">
            {MEMBER_TYPES.map((t) => (
              <label key={t} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm ${audienceTypes.includes(t) ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300"}`}>
                <input type="checkbox" checked={audienceTypes.includes(t)} onChange={() => setAudienceTypes((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))} className="sr-only" />{MEMBER_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
          {audienceTypes.length > 0 && (
            <div className="space-y-1.5 rounded-xl bg-neutral-50 p-3 text-sm">
              <label className="flex min-h-10 items-start gap-3"><input type="radio" name="aud" checked={!audienceOnly} onChange={() => setAudienceOnly(false)} className="mt-1 h-4 w-4" /><span><strong>แนะนำสำหรับกลุ่มนี้</strong> — ทุกคนลงทะเบียนได้ แต่ขึ้นป้าย “แนะนำสำหรับ …” บนการ์ดและหน้าคอร์ส</span></label>
              <label className="flex min-h-10 items-start gap-3"><input type="radio" name="aud" checked={audienceOnly} onChange={() => setAudienceOnly(true)} className="mt-1 h-4 w-4" /><span><strong>เปิดเฉพาะกลุ่มนี้</strong> — คนประเภทอื่นเห็นรายละเอียดแต่ลงทะเบียนไม่ได้ (ตรวจจากประเภทสมาชิกที่ผู้ดูแลกำหนด)</span></label>
            </div>
          )}
        </fieldset>
      </section>

      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">ภาพปก</h2>
        <CoverField currentUrl={values.coverUrl} currentDrive={values.coverDrive} fx={values.coverFx} fy={values.coverFy} allowUpload={allowUpload} onChange={setCover} emptyText="ยังไม่มีภาพปก — ต้องมีภาพปกก่อนส่งตรวจ" />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="flex min-h-12 items-center gap-2 rounded-xl bg-brand px-7 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">{pending && <Spinner className="h-4 w-4" />}{values.id ? "บันทึก" : "สร้างคอร์สและไปเพิ่มเนื้อหา"}</button>
        {values.id && <p className="text-xs text-neutral-500">การแก้ไขคอร์สที่เผยแพร่แล้วต้องรอผู้ตรวจอนุมัติใหม่ (ผู้ดูแลระบบไม่ต้อง)</p>}
      </div>
    </form>
  );
}
