"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import ColorPicker from "@/components/admin/color-picker";
import Glyph, { IconTile } from "@/components/glyph";
import type { AvatarData } from "@/lib/avatar";
import { CHOICE_KEYS } from "@/lib/icon-paths";
import IconField from "./icon-field";
import { saveResource, type ResourceFormState } from "./actions";

export type ResourceValues = { id?: string; name: string; url: string; description: string; groupName: string; icon: string; color: string; active: boolean };

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";
const ICONS = [...CHOICE_KEYS, "link", "youtube"] as string[];

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{pending ? "กำลังบันทึก..." : children}</button>;
}

/** Add (no id) or edit one outside media source. */
export default function ResourceForm({ values, groups, image, allowUpload }: { values: ResourceValues; groups: string[]; image: AvatarData | null; allowUpload: boolean }) {
  const router = useRouter();
  const [nonce, setNonce] = useState(0);
  const isNew = !values.id;
  const [state, action] = useFormState<ResourceFormState, FormData>(saveResource.bind(null, values.id ?? null), undefined);
  const [icon, setIcon] = useState(values.icon);
  const [color, setColor] = useState(values.color);
  const [name, setName] = useState(values.name);

  // after a save: show the new picture / list, and give "add" a clean form again
  useEffect(() => {
    if (!state?.saved) return;
    router.refresh();
    if (!values.id) setNonce((n) => n + 1);
  }, [state, router, values.id]);

  return (
    <form action={action} key={`${values.id ?? "new"}-${nonce}`} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{isNew ? "เพิ่มแหล่งสื่อภายนอก" : "แก้ไขแหล่งสื่อ"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-medium">ชื่อ *</span><input name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ThaiMOOC" className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-medium">กลุ่ม</span><input name="groupName" list="resource-groups" maxLength={40} defaultValue={values.groupName} placeholder="เช่น วิดีโอ / คลังความรู้ / เครื่องมือ" className={input} /></label>
        <datalist id="resource-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        <label className="block space-y-1 sm:col-span-2"><span className="text-sm font-medium">ลิงก์ * (ต้องขึ้นต้น https://)</span><input name="url" required inputMode="url" autoCapitalize="none" spellCheck={false} defaultValue={values.url} placeholder="https://www.thaimooc.org" className={input} /></label>
        <label className="block space-y-1 sm:col-span-2"><span className="text-sm font-medium">คำอธิบายสั้นๆ (ไม่เกิน 200 ตัวอักษร)</span><input name="description" maxLength={200} defaultValue={values.description} className={input} /></label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">ไอคอน</legend>
        <input type="hidden" name="icon" value={icon} />
        <div className="flex flex-wrap gap-2">
          {ICONS.map((k) => (
            <button key={k} type="button" aria-label={`ไอคอน ${k}`} aria-pressed={icon === k} onClick={() => setIcon(k)} className={`flex h-11 w-11 items-center justify-center rounded-xl border ${icon === k ? "border-brand bg-brand-soft text-brand" : "border-neutral-200 text-neutral-500 hover:bg-neutral-50"}`}>
              <Glyph name={k} size={20} />
            </button>
          ))}
        </div>
      </fieldset>
      <ColorPicker label="สี" name="color" value={color} onChange={setColor} />
      <IconField current={image} allowUpload={allowUpload} icon={icon} color={color} />

      <div className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3 text-sm">
        <IconTile name={icon} color={color} size={44} /><span className="text-xs text-neutral-500">ถ้ามีรูปไอคอนของตัวเอง จะแสดงรูปแทนไอคอนนี้</span>
        <span className="font-medium">{name || "ตัวอย่างการ์ด"}</span>
      </div>

      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={values.active} className="h-4 w-4" /> แสดงบนเว็บไซต์</label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-green-700">{isNew ? "เพิ่มแล้ว — ดูในรายการด้านล่าง" : "บันทึกแล้ว"}</p>}
      <div className="flex flex-wrap gap-2">
        <Submit>{isNew ? "เพิ่มรายการ" : "บันทึก"}</Submit>
        {!isNew && <a href="/admin/resources" className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-5 text-sm">เลิกแก้ไข</a>}
      </div>
    </form>
  );
}
