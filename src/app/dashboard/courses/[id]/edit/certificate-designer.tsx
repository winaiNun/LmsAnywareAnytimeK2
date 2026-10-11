"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import CertificateView from "@/components/certificate/certificate-view";
import { BUILTIN_FONTS, FIELD_KEYS, FIELD_LABEL, SAMPLE_VALUES, TOKENS, type CertField, type CertValues, type FieldKey } from "@/lib/certificate/schema";
import { deleteDesignAction, saveDesignAction, setDesignImageAction } from "./certificate-actions";

export type DesignerData = {
  id: string; name: string; isDefault: boolean; minScore: number | null; serialId: string | null;
  imageSrc: string | null; aspect: number; fields: CertField[]; hasCertificates: boolean;
};

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";
const btn = "flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-50";

function Num({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="min-w-0 flex-1 accent-[#0052FF]" />
        <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))} aria-label={`${label} (ตัวเลข)`} className="min-h-10 w-20 rounded-lg border border-neutral-300 px-2 text-center" />
      </div>
    </label>
  );
}

export default function CertificateDesigner({ courseId, design, serials, isAdmin, customFonts, courseSample }: {
  courseId: string; design: DesignerData; serials: { id: string; name: string; pattern: string }[]; isAdmin: boolean;
  customFonts: { id: string; name: string }[]; courseSample: Partial<CertValues>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<CertField[]>(design.fields);
  const [name, setName] = useState(design.name);
  const [isDefault, setIsDefault] = useState(design.isDefault);
  const [minScore, setMinScore] = useState(design.minScore === null ? "" : String(design.minScore));
  const [serialId, setSerialId] = useState(design.serialId ?? "");
  const [sampleName, setSampleName] = useState("นายสมชาย ใจดี");
  const [view, setView] = useState<"result" | "boxes">("boxes");
  const [selected, setSelected] = useState<FieldKey>("name");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const values = useMemo<Partial<CertValues>>(() => ({ ...SAMPLE_VALUES, ...courseSample, name: sampleName || SAMPLE_VALUES.name }), [courseSample, sampleName]);
  const usedFonts = customFonts.filter((f) => fields.some((x) => x.font === `f:${f.id}`));
  const cur = fields.find((f) => f.key === selected) ?? fields[0];

  const patch = (key: FieldKey, p: Partial<CertField>) => { setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...p } : f))); setDirty(true); setMsg(null); };
  const done = (ok: boolean, text: string) => setMsg({ ok, text });

  function save() {
    const ms = minScore.trim() === "" ? null : Number(minScore);
    start(async () => {
      const r = await saveDesignAction(courseId, design.id, { name, isDefault, minScore: ms, serialId: serialId || null, fields });
      if (r.ok) { setDirty(false); done(true, "บันทึกแล้ว"); router.refresh(); } else done(false, r.error);
    });
  }
  function useImage() {
    start(async () => {
      const r = await setDesignImageAction(courseId, design.id, link);
      if (r.ok) { setLink(""); done(true, "ใส่ภาพเทมเพลตแล้ว"); router.refresh(); } else done(false, r.error);
    });
  }
  function remove() {
    if (!confirm(`ลบแบบเกียรติบัตร “${design.name}”?`)) return;
    start(async () => {
      const r = await deleteDesignAction(courseId, design.id);
      if (r.ok) router.push(`/dashboard/courses/${courseId}/edit?tab=certificate`); else done(false, r.error);
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="มุมมอง" className="flex gap-1 rounded-xl bg-neutral-100 p-1">
          {([["boxes", "ตำแหน่งข้อมูล"], ["result", "ผลลัพธ์"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k} className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${view === k ? "bg-white text-brand shadow" : "text-neutral-600"}`}>{l}</button>
          ))}
        </div>
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm"><span className="shrink-0 font-medium">ชื่อตัวอย่าง</span><input value={sampleName} onChange={(e) => setSampleName(e.target.value)} maxLength={80} className={input} /></label>
      </div>

      <CertificateView
        imageSrc={design.imageSrc} aspect={design.aspect} fields={fields} values={values} usedFonts={usedFonts}
        boxes={view === "boxes"} editable={view === "boxes"} selected={selected} onSelect={setSelected}
        onMove={(k, x, y) => patch(k, { x, y })}
        className="rounded-xl shadow-md ring-1 ring-black/10"
      />
      <p className="text-xs text-neutral-500">{view === "boxes" ? "ลากกรอบเพื่อย้ายตำแหน่ง · แต่ละกรอบบอกว่าข้อมูลมาจากช่องไหน · ชื่อที่ยาวเกินกรอบจะย่อตัวอักษรให้พอดีอัตโนมัติ" : "นี่คือหน้าตาเมื่อพิมพ์จริง (ข้อมูลเป็นตัวอย่าง)"}</p>

      {/* template picture */}
      <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold">ภาพเทมเพลต</h3>
        <p className="text-sm text-neutral-600">อัปโหลดภาพพื้นเกียรติบัตร (A4 แนวนอน กว้างอย่างน้อย 1600 พิกเซล ไม่ต้องใส่ชื่อ/เลข) ไว้ใน Google Drive แชร์เป็น “ทุกคนที่มีลิงก์” แล้ววางลิงก์ที่นี่</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/file/d/…/view" aria-label="ลิงก์ภาพเทมเพลตจาก Google Drive" className={input} />
          <button type="button" onClick={useImage} disabled={pending || !link.trim()} className={`${btn} shrink-0 bg-brand text-white hover:bg-brand-dark`}>ใช้ภาพนี้</button>
        </div>
      </div>

      {/* fields */}
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold">ข้อมูลที่จะแสดง <span className="text-sm font-normal text-neutral-500">(ไม่ต้องการอันไหนก็ไม่ติ๊ก)</span></h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {FIELD_KEYS.map((k) => {
            const f = fields.find((x) => x.key === k)!;
            return (
              <li key={k} className={`flex items-center gap-3 rounded-lg border p-2 ${selected === k ? "border-brand bg-brand-soft" : "border-neutral-200"}`}>
                <input type="checkbox" checked={f.enabled} onChange={(e) => { patch(k, { enabled: e.target.checked }); if (e.target.checked) setSelected(k); }} aria-label={`แสดง ${FIELD_LABEL[k].label}`} className="h-5 w-5 shrink-0 accent-[#0052FF]" />
                <button type="button" onClick={() => setSelected(k)} className="min-h-9 min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold">{FIELD_LABEL[k].label}</span>
                  <span className="block truncate text-xs text-neutral-500">{FIELD_LABEL[k].hint}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {cur && (
          <div className="space-y-3 rounded-lg bg-neutral-50 p-3" aria-label={`ตั้งค่า ${FIELD_LABEL[cur.key].label}`}>
            <h4 className="text-sm font-semibold">ตั้งค่า: {FIELD_LABEL[cur.key].label}{!cur.enabled && <span className="ml-2 font-normal text-amber-700">(ยังไม่ได้ติ๊กแสดง)</span>}</h4>
            <label className="block space-y-1">
              <span className="text-sm font-medium">ข้อความ</span>
              <input value={cur.text} onChange={(e) => patch(cur.key, { text: e.target.value })} maxLength={200} className={input} />
            </label>
            <div className="flex flex-wrap gap-1.5" aria-label="แทรกข้อมูลจากฐานข้อมูล">
              {TOKENS.map((t) => (
                <button key={t.token} type="button" onClick={() => patch(cur.key, { text: `${cur.text}${cur.text && !cur.text.endsWith(" ") ? " " : ""}{${t.token}}` })} title={`ตัวอย่าง: ${t.example}`} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs hover:border-brand hover:text-brand">+ {t.label}</button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium">ฟอนต์</span>
                <select value={cur.font} onChange={(e) => patch(cur.key, { font: e.target.value })} className={input}>
                  <optgroup label="ฟอนต์ในระบบ">{BUILTIN_FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</optgroup>
                  {customFonts.length > 0 && <optgroup label="ฟอนต์ที่แอดมินเพิ่ม">{customFonts.map((f) => <option key={f.id} value={`f:${f.id}`}>{f.name}</option>)}</optgroup>}
                </select>
              </label>
              <div className="space-y-1">
                <span className="text-sm font-medium">สีข้อความ</span>
                <div className="flex items-center gap-2">
                  <input type="color" value={cur.color} onChange={(e) => patch(cur.key, { color: e.target.value })} aria-label="เลือกสี" className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-neutral-300 bg-white p-1" />
                  <input value={cur.color} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && patch(cur.key, { color: e.target.value.toLowerCase() })} onBlur={(e) => !/^#[0-9a-f]{6}$/.test(e.target.value) && patch(cur.key, { color: "#000000" })} aria-label="รหัสสี" className={`${input} font-mono`} />
                </div>
              </div>
              <Num label="ขนาดตัวอักษร" value={cur.size} min={8} max={200} onChange={(v) => patch(cur.key, { size: v })} />
              <div className="space-y-1">
                <span className="text-sm font-medium">การจัดชิด</span>
                <div role="group" className="flex gap-1 rounded-xl bg-neutral-100 p-1">
                  {([["left", "ซ้าย"], ["center", "กลาง"], ["right", "ขวา"]] as const).map(([a, l]) => (
                    <button key={a} type="button" onClick={() => patch(cur.key, { align: a })} aria-pressed={cur.align === a} className={`min-h-10 flex-1 rounded-lg text-sm font-semibold ${cur.align === a ? "bg-white text-brand shadow" : "text-neutral-600"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <Num label="ตำแหน่งแนวนอน (ซ้าย → ขวา, %)" value={cur.x} min={0} max={Math.max(0, 100 - cur.w)} step={0.5} onChange={(v) => patch(cur.key, { x: v })} />
              <Num label="ตำแหน่งแนวตั้ง (บน → ล่าง, %)" value={cur.y} min={0} max={100} step={0.5} onChange={(v) => patch(cur.key, { y: v })} />
              <Num label="ความกว้างกรอบ (%)" value={cur.w} min={5} max={100} step={0.5} onChange={(v) => patch(cur.key, { w: v, x: Math.min(cur.x, 100 - v) })} />
            </div>
          </div>
        )}
      </div>

      {/* design settings */}
      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold">การใช้แบบนี้</h3>
        <label className="block space-y-1"><span className="text-sm font-medium">ชื่อแบบ</span><input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} maxLength={80} className={input} /></label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={isDefault} onChange={(e) => { setIsDefault(e.target.checked); setDirty(true); }} className="h-5 w-5 accent-[#0052FF]" /><span className="text-sm">เป็นแบบเริ่มต้น (ผู้เรียนที่ไม่เข้าเงื่อนไขแบบอื่นจะได้แบบนี้)</span></label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">คะแนนแบบทดสอบเฉลี่ยตั้งแต่ (%) — เว้นว่างถ้าไม่ใช้เงื่อนไข</span>
          <input type="number" min={1} max={100} value={minScore} onChange={(e) => { setMinScore(e.target.value); setDirty(true); }} className={`${input} sm:max-w-40`} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">ชุดเลขเกียรติบัตร</span>
          <select value={serialId} onChange={(e) => { setSerialId(e.target.value); setDirty(true); }} disabled={!isAdmin || design.hasCertificates} className={input}>
            <option value="">ไม่ใช้เลข (ออกเกียรติบัตรทันทีเมื่อเรียนจบ)</option>
            {serials.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.pattern})</option>)}
          </select>
          <span className="block text-xs text-neutral-500">{isAdmin ? (design.hasCertificates ? "มีผู้เรียนได้เกียรติบัตรจากแบบนี้แล้ว เปลี่ยนชุดเลขไม่ได้" : "ผู้เรียนจะเห็น “รอออกเลข” จนกว่าผู้ดูแลระบบจะกดออกเลข") : "เฉพาะผู้ดูแลระบบที่เลือกชุดเลขได้ (เลขมาจากทะเบียนของเขตพื้นที่)"}</span>
        </label>
      </div>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-white/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur md:bottom-4">
        <button type="button" onClick={save} disabled={pending} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>{pending ? "กำลังบันทึก…" : "บันทึกแบบนี้"}</button>
        {dirty && <span className="text-sm text-amber-700">มีการแก้ไขที่ยังไม่บันทึก</span>}
        {msg && <span role={msg.ok ? "status" : "alert"} className={`text-sm font-medium ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
        <button type="button" onClick={remove} disabled={pending} className={`${btn} ml-auto border border-red-300 text-red-700 hover:bg-red-50`}>ลบแบบนี้</button>
      </div>
    </section>
  );
}
