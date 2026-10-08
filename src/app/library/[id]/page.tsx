import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNavbar from "@/components/site-navbar";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Basic public page for one media item. Borrow/read actions come with the library module.
export default async function LibraryItemPage({ params }: { params: { id: string } }) {
  const book = await db.book.findUnique({
    where: { id: params.id },
    include: { category: true, authors: { include: { author: true } }, copies: { include: { loans: { where: { returnedAt: null } } } } },
  });
  if (!book) notFound();

  const free = book.copies.filter((c) => c.loans.length === 0).length;

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-28 pt-24 md:pb-16">
        <Link href="/#media" className="text-sm text-brand">← สื่อการเรียนรู้ทั้งหมด</Link>
        <h1 className="text-3xl font-bold">{book.title}</h1>
        <dl className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 text-sm sm:grid-cols-2">
          <div><dt className="text-neutral-500">ผู้แต่ง</dt><dd className="font-medium">{book.authors.map((a) => a.author.name).join(", ") || "—"}</dd></div>
          <div><dt className="text-neutral-500">หมวดหมู่</dt><dd className="font-medium">{book.category?.name ?? "—"}</dd></div>
          <div><dt className="text-neutral-500">สถานะ</dt><dd className="font-medium">{book.copies.length === 0 ? "ยังไม่มีเล่ม" : free > 0 ? `ว่าง ${free} จาก ${book.copies.length} เล่ม` : "ถูกยืมหมด"}</dd></div>
          {book.isbn && <div><dt className="text-neutral-500">ISBN</dt><dd className="font-medium">{book.isbn}</dd></div>}
        </dl>
        {book.description && <p className="text-neutral-600">{book.description}</p>}
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">หน้านี้เป็นหน้าแสดงรายละเอียดเบื้องต้น ระบบยืม-คืนและอ่านออนไลน์จะเพิ่มในขั้นถัดไป</p>
      </main>
    </>
  );
}
