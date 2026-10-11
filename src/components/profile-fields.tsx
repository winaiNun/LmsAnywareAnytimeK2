"use client";

import { useState } from "react";
import SchoolPicker, { type SchoolOption } from "@/components/school-picker";
import PrefixField from "@/components/prefix-field";
import { MEMBER_TYPES, MEMBER_TYPE_LABEL, needsSchool, type MemberTypeKey } from "@/lib/members";

export type { SchoolOption };
export type ProfileValues = {
  memberType: MemberTypeKey;
  prefix: string;
  firstName: string;
  lastName: string;
  phone: string;
  schoolId: string;
  organization: string;
  position: string;
  gradeLevel: string;
};

export const emptyProfile: ProfileValues = { memberType: "GENERAL", prefix: "", firstName: "", lastName: "", phone: "", schoolId: "", organization: "", position: "", gradeLevel: "" };

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

/** Member-type dependent profile inputs (names match `profileSchema`). Used by "my profile" and the admin form. */
export default function ProfileFields({ values, schools }: { values: ProfileValues; schools: SchoolOption[] }) {
  const [type, setType] = useState<MemberTypeKey>(values.memberType);
  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">ประเภทสมาชิก</span>
        <select name="memberType" value={type} onChange={(e) => setType(e.target.value as MemberTypeKey)} className={input}>
          {MEMBER_TYPES.map((t) => <option key={t} value={t}>{MEMBER_TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <PrefixField defaultValue={values.prefix} className={input} />
        <label className="block space-y-1"><span className="text-sm font-medium">ชื่อ *</span><input name="firstName" required maxLength={60} defaultValue={values.firstName} className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">นามสกุล *</span><input name="lastName" required maxLength={60} defaultValue={values.lastName} className={input} /></label>
      </div>
      {needsSchool(type) ? (
        <div className="space-y-1"><span className="text-sm font-medium">โรงเรียน *</span><SchoolPicker schools={schools} defaultValue={values.schoolId} required /></div>
      ) : (
        <label className="block space-y-1"><span className="text-sm font-medium">หน่วยงาน/สังกัด{type === "SUPERVISOR" && " *"}</span><input name="organization" required={type === "SUPERVISOR"} maxLength={120} defaultValue={values.organization} className={input} /></label>
      )}
      {type === "STUDENT" ? (
        <label className="block space-y-1"><span className="text-sm font-medium">ชั้น</span><input name="gradeLevel" maxLength={40} defaultValue={values.gradeLevel} className={input} /></label>
      ) : (
        <label className="block space-y-1"><span className="text-sm font-medium">ตำแหน่ง/วิทยฐานะ</span><input name="position" maxLength={120} defaultValue={values.position} className={input} /></label>
      )}
      <label className="block space-y-1"><span className="text-sm font-medium">เบอร์โทร</span><input name="phone" type="tel" maxLength={20} defaultValue={values.phone} className={input} /></label>
    </div>
  );
}
