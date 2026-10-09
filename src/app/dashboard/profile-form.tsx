"use client";

import { useFormState, useFormStatus } from "react-dom";
import ProfileFields, { type ProfileValues, type SchoolOption } from "@/components/profile-fields";
import { removePin, requestCreator, setPin, updateProfile, type ProfileState } from "./actions";

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

const pinInput = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 tracking-[0.4em]";

export function PinForm({ hasPin }: { hasPin: boolean }) {
  const [state, action] = useFormState<ProfileState, FormData>(setPin, undefined);
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">PIN 6 หลัก (เข้าสู่ระบบเร็ว)</h2>
      <p className="text-sm text-neutral-500">{hasPin ? "ตั้ง PIN ไว้แล้ว — กรอกใหม่เพื่อเปลี่ยน" : "ตั้ง PIN เพื่อเข้าสู่ระบบบนมือถือโดยไม่ต้องพิมพ์รหัสผ่าน"} (ล็อก 15 นาทีถ้าใส่ผิด 5 ครั้ง)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-medium">PIN ใหม่</span><input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off" className={pinInput} /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">ยืนยัน PIN</span><input name="confirm" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off" className={pinInput} /></label>
      </div>
      <label className="block space-y-1"><span className="text-sm font-medium">รหัสผ่านปัจจุบัน (เพื่อยืนยันตัวตน)</span><input name="password" type="password" required autoComplete="current-password" className="min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3" /></label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">บันทึก PIN แล้ว</p>}
      <div className="flex flex-wrap gap-3">
        <Submit>{hasPin ? "เปลี่ยน PIN" : "ตั้ง PIN"}</Submit>
        {hasPin && <button type="button" onClick={() => removePin()} className="min-h-11 rounded-lg border border-red-200 px-5 text-red-600">ลบ PIN</button>}
      </div>
    </form>
  );
}
