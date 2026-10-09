"use client";

import { useFormState, useFormStatus } from "react-dom";
import ProfileFields, { type ProfileValues, type SchoolOption } from "@/components/profile-fields";
import { requestCreator, updateProfile, type ProfileState } from "./actions";

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
