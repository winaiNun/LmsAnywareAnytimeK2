import Link from "next/link";
import Glyph from "@/components/glyph";
import SiteNavbar from "@/components/site-navbar";

export const metadata = { title: "ไม่พบหน้านี้" };

export default function NotFound() {
  return (
    <>
      <SiteNavbar />
      <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 pb-12 pt-24 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-soft text-brand"><Glyph name="search" size={38} /></span>
        <p className="mt-6 text-5xl font-bold tracking-tight text-brand">404</p>
        <h1 className="mt-2 text-2xl font-bold">ไม่พบหน้าที่ต้องการ</h1>
        <p className="mt-2 text-neutral-600">ลิงก์อาจผิด หรือหน้านี้ถูกย้ายหรือลบไปแล้ว ลองกลับไปหน้าแรกหรือค้นหาสื่อในคลัง</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="flex min-h-12 items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-white hover:bg-brand-dark"><Glyph name="home" size={18} />หน้าแรก</Link>
          <Link href="/library" className="flex min-h-12 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-6 font-medium hover:bg-neutral-50"><Glyph name="book-open" size={18} />คลังสื่อ</Link>
        </div>
      </main>
    </>
  );
}
