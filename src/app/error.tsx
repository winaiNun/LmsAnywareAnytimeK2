"use client";

import Link from "next/link";
import Glyph from "@/components/glyph";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-12 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-600"><Glyph name="help-circle" size={38} /></span>
      <h1 className="mt-6 text-2xl font-bold">เกิดข้อผิดพลาดบางอย่าง</h1>
      <p className="mt-2 text-neutral-600">ขออภัย ระบบขัดข้องชั่วคราว ลองโหลดใหม่อีกครั้ง หากยังเป็นอยู่ โปรดแจ้งผู้ดูแลระบบ</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="flex min-h-12 items-center rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark">ลองอีกครั้ง</button>
        <Link href="/" className="flex min-h-12 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-6 font-medium hover:bg-neutral-50"><Glyph name="home" size={18} />หน้าแรก</Link>
      </div>
    </main>
  );
}
