import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const [books, total] = await Promise.all([
    db.book.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { category: true, authors: { include: { author: true } }, copies: { include: { loans: { where: { returnedAt: null } } } } },
    }),
    db.book.count(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">คลังสื่อการเรียนรู้</h1>
        <p className="text-sm text-neutral-500">ทั้งหมด {total} รายการ (หน้านี้เป็นรายการอ่านอย่างเดียว ฟอร์มเพิ่ม/แก้ไขจะทำเป็นขั้นต่อไป)</p>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white p-2 shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-neutral-500">
            <tr><th className="p-3 font-medium">ชื่อสื่อ</th><th className="p-3 font-medium">ผู้แต่ง</th><th className="p-3 font-medium">หมวด</th><th className="p-3 font-medium">ทั้งหมด</th><th className="p-3 font-medium">ว่าง</th></tr>
          </thead>
          <tbody>
            {books.map((b) => {
              const out = b.copies.filter((c) => c.loans.length > 0).length;
              const free = b.copies.length - out;
              return (
                <tr key={b.id} className="border-t border-neutral-100">
                  <td className="p-3 font-medium">{b.title}</td>
                  <td className="p-3 text-neutral-600">{b.authors.map((a) => a.author.name).join(", ") || "—"}</td>
                  <td className="p-3 text-neutral-600">{b.category?.name ?? "—"}</td>
                  <td className="p-3">{b.copies.length}</td>
                  <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${free > 0 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{free > 0 ? `ว่าง ${free}` : "ถูกยืมหมด"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
