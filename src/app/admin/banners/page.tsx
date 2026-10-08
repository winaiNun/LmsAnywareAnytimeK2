import Link from "next/link";
import { db } from "@/lib/db";
import { bannerImageUrl } from "@/lib/banners";
import { deleteBanner, toggleBanner } from "./actions";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default async function BannersPage() {
  const banners = await db.banner.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">แบนเนอร์แนะนำ</h1>
        <Link href="/admin/banners/new" className="flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-dark">
          + เพิ่มแบนเนอร์
        </Link>
      </div>

      {banners.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-500">
          ยังไม่มีแบนเนอร์ หน้าแรกจะแสดงข้อความต้อนรับเริ่มต้น
        </p>
      ) : (
        <ul className="space-y-3">
          {banners.map((b) => {
            const img = bannerImageUrl(b.imageKey);
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: b.bgColor }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {img && <img src={img} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.title}</p>
                  <p className="text-sm text-neutral-500">
                    ลำดับ {b.sortOrder} · {fmt(b.startAt)} ถึง {fmt(b.endAt)}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm ${b.active ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
                  {b.active ? "เปิดอยู่" : "ปิดอยู่"}
                </span>
                <div className="flex gap-2">
                  <form action={toggleBanner.bind(null, b.id)}>
                    <button className="min-h-10 rounded-lg border border-neutral-300 px-3 text-sm">{b.active ? "ปิด" : "เปิด"}</button>
                  </form>
                  <Link href={`/admin/banners/${b.id}`} className="flex min-h-10 items-center rounded-lg border border-neutral-300 px-3 text-sm">แก้ไข</Link>
                  <form action={deleteBanner.bind(null, b.id)}>
                    <button className="min-h-10 rounded-lg border border-red-200 px-3 text-sm text-red-600">ลบ</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
