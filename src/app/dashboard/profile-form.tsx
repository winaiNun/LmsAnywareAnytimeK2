"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { readDevice, saveDevice, usePhone } from "@/lib/use-phone";
import ProfileFields, { type ProfileValues, type SchoolOption } from "@/components/profile-fields";
import { removeDevice, requestCreator, setPin, updateProfile, type ProfileState } from "./actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : children}</button>;
}

export function ProfileForm({ values, schools }: { values: ProfileValues; schools: SchoolOption[] }) {
  const [state, action] = useFormState<ProfileState, FormData>(updateProfile, undefined);
  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">ข้อมูลส่วนตัว</h2>
      <ProfileFields values={values} schools={schools} />
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">บันทึกแล้ว</p>}
      <Submit>บันทึกข้อมูล</Submit>
    </form>
  );
}

export function CreatorRequestForm() {
  const [state, action] = useFormState<ProfileState, FormData>(requestCreator, undefined);
  if (state?.saved) return <p role="status" className="text-sm text-green-700">ส่งคำขอแล้ว รอผู้ดูแลพิจารณา</p>;
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">เหตุผล/สิ่งที่ต้องการสอน</span>
        <textarea name="reason" required minLength={10} maxLength={500} rows={3} className="w-full rounded-lg border border-neutral-300 px-3 py-2" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <Submit>สมัครเป็นผู้สร้างคอร์สเรียน</Submit>
    </form>
  );
}

const pinInput = "min-h-12 w-full rounded-lg border border-neutral-300 bg-white px-3 text-center text-xl tracking-[0.5em]";

export type DeviceRow = { id: string; label: string; lastUsed: string };

/** Phone-only: set a PIN for this phone. Hidden on computers, where people sign in normally. */
export function PinForm({ devices }: { devices: DeviceRow[] }) {
  const phone = usePhone();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [thisPhone, setThisPhone] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => setThisPhone(!!readDevice()), []);
  if (!phone) return null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setDone(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("token", readDevice()?.token ?? "");
    start(async () => {
      const r = await setPin(fd);
      if (r?.error) return setError(r.error);
      if (r?.token) { saveDevice({ token: r.token, name: r.name ?? "" }); setThisPhone(true); }
      setDone(true);
      form.reset();
    });
  }

  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">PIN 6 หลักสำหรับมือถือเครื่องนี้</h2>
      <p className="text-sm text-neutral-500">
        {thisPhone ? "เครื่องนี้ตั้ง PIN ไว้แล้ว กรอกใหม่เพื่อเปลี่ยน" : "ครั้งต่อไปเปิดแอปแล้วกดแค่ PIN ไม่ต้องพิมพ์อีเมลหรือรหัสผ่าน"} PIN ใช้ได้เฉพาะบนเครื่องนี้ ใส่ผิด 5 ครั้งเครื่องจะถูกยกเลิก
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1"><span className="text-sm font-medium">PIN ใหม่</span><input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off" className={pinInput} /></label>
          <label className="block space-y-1"><span className="text-sm font-medium">ยืนยัน PIN</span><input name="confirm" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off" className={pinInput} /></label>
        </div>
        <label className="block space-y-1"><span className="text-sm font-medium">รหัสผ่านปัจจุบัน (ยืนยันตัวตน)</span><input name="password" type="password" required autoComplete="current-password" className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3" /></label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {done && <p role="status" className="text-sm text-green-700">บันทึก PIN สำหรับเครื่องนี้แล้ว</p>}
        <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white disabled:opacity-50">{pending ? "กำลังบันทึก..." : thisPhone ? "เปลี่ยน PIN" : "ตั้ง PIN"}</button>
      </form>

      {devices.length > 0 && (
        <div className="border-t pt-3">
          <h3 className="text-sm font-medium">เครื่องที่ตั้ง PIN ไว้</h3>
          <ul className="mt-2 space-y-2">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{d.label}<span className="block text-xs text-neutral-500">ใช้ล่าสุด {d.lastUsed}</span></span>
                <button type="button" onClick={() => start(async () => { await removeDevice(d.id); })} className="min-h-10 rounded-lg border border-red-200 px-3 text-red-600">ยกเลิก</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
