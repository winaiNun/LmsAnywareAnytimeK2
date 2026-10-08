"use client";

import { useFormState, useFormStatus } from "react-dom";
import CropImageField from "@/components/admin/crop-image-field";
import { saveBanner, type BannerFormState } from "./actions";

type Initial = {
  id: string;
  title: string;
  subtitle: string | null;
  linkUrl: string | null;
  buttonText: string | null;
  bgColor: string;
  active: boolean;
  showText: boolean;
  sortOrder: number;
  startAt: string; // datetime-local value or ""
  endAt: string;
  imageUrl: string | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
      {pending ? "กำลังบันทึก..." : "บันทึก"}
    </button>
  );
}

const input = "min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3";

export default function BannerForm({ initial }: { initial?: Initial }) {
  const [state, action] = useFormState<BannerFormState, FormData>(saveBanner.bind(null, initial?.id ?? null), undefined);

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
      <label className="block space-y-1">
        <span className="text-sm font-medium">หัวข้อ (ชื่อคอร์ส/สื่อ) *</span>
        <input name="title" required maxLength={120} defaultValue={initial?.title} className={input} />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">คำอธิบายสั้น</span>
        <textarea name="subtitle" maxLength={300} rows={2} defaultValue={initial?.subtitle ?? ""} className={`${input} py-2`} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">ลิงก์ปลายทาง</span>
          <input name="linkUrl" placeholder="/library หรือ https://..." defaultValue={initial?.linkUrl ?? ""} className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">ข้อความบนปุ่ม</span>
          <input name="buttonText" maxLength={40} placeholder="ดูรายละเอียด" defaultValue={initial?.buttonText ?? ""} className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">แสดงตั้งแต่</span>
          <input type="datetime-local" name="startAt" defaultValue={initial?.startAt} className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">แสดงถึง</span>
          <input type="datetime-local" name="endAt" defaultValue={initial?.endAt} className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">ลำดับ (น้อยขึ้นก่อน)</span>
          <input type="number" name="sortOrder" defaultValue={initial?.sortOrder ?? 0} className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">สีพื้นหลัง (เมื่อไม่มีรูป)</span>
          <input type="color" name="bgColor" defaultValue={initial?.bgColor ?? "#EAF0FF"} className="h-11 w-full rounded-lg border border-neutral-300 bg-white p-1" />
        </label>
      </div>

      <CropImageField name="image" label="รูปป้ายสไลด์ (ครอบเป็น 3:1)" aspects={[{ label: "3:1", value: 3 }]} currentUrl={initial?.imageUrl ?? null} maxWidth={1800} />
      {initial?.imageUrl && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="removeImage" /> ลบรูปปัจจุบัน
        </label>
      )}

      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="showText" defaultChecked={initial?.showText ?? true} className="h-4 w-4" />
        <span>แสดงหัวข้อ/ปุ่มทับบนรูป (ปิดไว้ถ้าในรูปมีข้อความอยู่แล้ว)</span>
      </label>

      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="h-4 w-4" />
        <span>เปิดใช้งาน</span>
      </label>

      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-3">
        <Submit />
        <a href="/admin/banners" className="flex min-h-11 items-center rounded-lg border border-neutral-300 px-6">ยกเลิก</a>
      </div>
    </form>
  );
}
