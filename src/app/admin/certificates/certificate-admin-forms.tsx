"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addFontAction, deleteFontAction, deleteSerialAction, saveSerialAction } from "@/app/dashboard/courses/[id]/edit/certificate-actions";
import { formatSerialNumber, patternProblem } from "@/lib/certificate/schema";

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";
const btn = "flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-50";

export type SerialRow = { id: string; name: string; pattern: string; padding: number; nextNo: number; resetYearly: boolean; used: number; designs: number };

export function SerialForm({ serial }: { serial: SerialRow | null }) {
  const router = useRouter();
  const [name, setName] = useState(serial?.name ?? "");
  const [pattern, setPattern] = useState(serial?.pattern ?? "{no}/{year}");
  const [padding, setPadding] = useState(String(serial?.padding ?? 4));
  const [nextNo, setNextNo] = useState(String(serial?.nextNo ?? 1));
  const [reset, setReset] = useState(serial?.resetYearly ?? true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const frozen = !!serial && serial.used > 0;
  const bad = patternProblem(pattern);
  const preview = bad ? "—" : formatSerialNumber(pattern, Number(nextNo) || 1, Number(padding) || 4, 2569);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveSerialAction(serial?.id ?? null, { name, pattern, padding: Number(padding), nextNo: Number(nextNo), resetYearly: reset });
          if (r.ok) {
            setMsg({ ok: true, text: "บันทึกแล้ว" });
            if (!serial) { setName(""); setNextNo("1"); }
            router.refresh();
          } else setMsg({ ok: false, text: r.error });
        });
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-medium">ชื่อชุดเลข</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="เช่น หนังสือรับรองกลุ่มงานนิเทศ" className={input} /></label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">รูปแบบเลข</span>
          <input value={pattern} onChange={(e) => setPattern(e.target.value)} maxLength={40} required disabled={frozen} className={`${input} font-mono`} />
          <span className="block text-xs text-neutral-500">{`{no}`} = เลขลำดับ · {`{year}`} = ปี พ.ศ. · เช่น <span className="font-mono">ศธ 04001/{`{no}`}/{`{year}`}</span></span>
        </label>
        <label className="block space-y-1"><span className="text-sm font-medium">จำนวนหลักของเลขลำดับ</span><input type="number" min={1} max={8} value={padding} onChange={(e) => setPadding(e.target.value)} disabled={frozen} className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">{serial ? "เลขลำดับถัดไป" : "เลขลำดับเริ่มต้น"}</span><input type="number" min={1} value={nextNo} onChange={(e) => setNextNo(e.target.value)} className={input} /></label>
      </div>
      <label className="flex items-center gap-3"><input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} className="h-5 w-5 accent-[#0052FF]" /><span className="text-sm">เริ่มนับ 1 ใหม่เมื่อขึ้นปี พ.ศ. ใหม่</span></label>
      <p className="text-sm text-neutral-600">เลขถัดไปจะออกเป็น: <strong className="font-mono">{bad ? "—" : preview}</strong>{bad && <span className="ml-2 text-red-600">{bad}</span>}</p>
      {frozen && <p className="text-xs text-amber-700">ออกเลขไปแล้ว จึงเปลี่ยนรูปแบบไม่ได้ และเลขถัดไปปรับได้เฉพาะเพิ่มขึ้น</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending || !!bad} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>{pending ? "กำลังบันทึก…" : serial ? "บันทึก" : "+ สร้างชุดเลข"}</button>
        {msg && <span role={msg.ok ? "status" : "alert"} className={`text-sm font-medium ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}

export function DeleteButton({ kind, id, label }: { kind: "serial" | "font"; id: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`ลบ “${label}”?`)) return;
          start(async () => {
            const r = kind === "serial" ? await deleteSerialAction(id) : await deleteFontAction(id);
            if (r.ok) router.refresh(); else setError(r.error);
          });
        }}
        className="min-h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
      >ลบ</button>
      {error && <p role="alert" className="max-w-64 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function FontForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setMsg(null);
        start(async () => {
          const r = await addFontAction(new FormData(form));
          if (r.ok) { form.reset(); setMsg({ ok: true, text: "เพิ่มฟอนต์แล้ว" }); router.refresh(); } else setMsg({ ok: false, text: r.error });
        });
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-medium">ชื่อฟอนต์ (ที่จะแสดงในรายการเลือก)</span><input name="name" maxLength={60} required className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">ไฟล์ฟอนต์ (.ttf .otf .woff .woff2 ไม่เกิน 3 MB)</span><input name="file" type="file" accept=".ttf,.otf,.woff,.woff2" required className="block w-full text-sm" /></label>
      </div>
      <label className="flex items-start gap-3"><input name="confirm" type="checkbox" required className="mt-1 h-5 w-5 shrink-0 accent-[#0052FF]" /><span className="text-sm">ข้าพเจ้ายืนยันว่ามีสิทธิ์ใช้ฟอนต์นี้ (เป็นฟอนต์ฟรี/โอเพนซอร์ส หรือหน่วยงานมีลิขสิทธิ์) ฟอนต์จะถูกเก็บในฐานข้อมูลและส่งให้เบราว์เซอร์ของผู้ที่เปิดเกียรติบัตร</span></label>
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={pending} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>{pending ? "กำลังอัปโหลด…" : "+ เพิ่มฟอนต์"}</button>
        {msg && <span role={msg.ok ? "status" : "alert"} className={`text-sm font-medium ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
