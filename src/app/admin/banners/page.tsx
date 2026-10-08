import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bannerImageUrl, getActiveBanners, getSlideshowConfig } from "@/lib/banners";
import { db } from "@/lib/db";
import { isAdmin, isManager } from "@/lib/permissions";
import { formatThaiDate } from "@/lib/thai-date";
import { deleteBanner, moveBanner, setPublished, toggleBanner, togglePin } from "./actions";
import SlideshowSettings from "./slideshow-settings";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) => formatThaiDate(d, { time: true });

const PinIcon = ({ filled }: { filled?: boolean }) => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 3h6l-1 6 3.5 3.5V14h-11v-1.5L10 9 9 3zM12 14v7" />
  </svg>
);

const iconBtn = "flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm";

export default async function BannersPage() {
  const session = await getServerSession(authOptions);
  const role = session!.user.role;
  const userId = session!.user.id;
  const manager = isManager(role);
  const admin = isAdmin(role);

  const [banners, config, live] = await Promise.all([
    db.banner.findMany({
      // teachers only ever see their own slides
      where: manager ? undefined : { createdById: userId },
      orderBy: [{ pinned: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      include: { createdBy: { select: { name: true } } },
    }),
    manager ? getSlideshowConfig() : null,
    manager ? getActiveBanners() : [],
  ]);
  const pending = banners.filter((b) => !b.published).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">สไลด์แนะนำ</h1>
          {!manager && <p className="text-sm text-neutral-500">สไลด์ที่คุณสร้างจะขึ้นบนหน้าเว็บหลังแอดมินกดเผยแพร่ (ถ้าแก้ไขสไลด์ที่เผยแพร่แล้ว จะกลับไปรอเผยแพร่อีกครั้ง)</p>}
        </div>
        <Link href="/admin/banners/new" className="flex min-h-11 shrink-0 items-center rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand-dark">
          + เพิ่มสไลด์
        </Link>
      </div>

      {admin && pending > 0 && (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          มี <strong>{pending}</strong> สไลด์รอคุณตรวจและกด “เผยแพร่” ก่อนจะขึ้นบนหน้าเว็บ
        </p>
      )}

      {manager && config && <SlideshowSettings initial={config} banners={live} />}

      {banners.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-500">
          {manager ? "ยังไม่มีสไลด์ หน้าแรกจะไม่แสดงส่วนสไลด์" : "คุณยังไม่ได้สร้างสไลด์"}
        </p>
      ) : (
        <ul className="space-y-3">
          {banners.map((b, i) => {
            const img = bannerImageUrl(b.imageKey);
            const mine = b.createdById === userId;
            const canEdit = manager || mine;
            const canDelete = manager || (mine && !b.published);
            const sameGroupAbove = i > 0 && banners[i - 1].pinned === b.pinned;
            const sameGroupBelow = i < banners.length - 1 && banners[i + 1].pinned === b.pinned;
            return (
              <li key={b.id} className={`flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4 ${b.pinned ? "border-amber-300" : "border-neutral-200"}`}>
                {manager && (
                  <div className="flex flex-col gap-1">
                    <form action={moveBanner.bind(null, b.id, "up")}>
                      <button disabled={!sameGroupAbove} aria-label={`เลื่อน ${b.title} ขึ้น`} className="flex h-8 w-9 items-center justify-center rounded-md border border-neutral-300 hover:bg-neutral-50 disabled:opacity-30">↑</button>
                    </form>
                    <form action={moveBanner.bind(null, b.id, "down")}>
                      <button disabled={!sameGroupBelow} aria-label={`เลื่อน ${b.title} ลง`} className="flex h-8 w-9 items-center justify-center rounded-md border border-neutral-300 hover:bg-neutral-50 disabled:opacity-30">↓</button>
                    </form>
                  </div>
                )}
                <div className="h-16 w-28 shrink-0 overflow-hidden" style={{ backgroundColor: b.bgColor }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {img && <img src={img} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {b.pinned && <span className="text-amber-600" title="ปักหมุดอยู่หน้าสุด"><PinIcon filled /></span>}
                    <span className="truncate">{b.title}</span>
                  </p>
                  <p className="text-sm text-neutral-500">
                    {b.createdBy ? `สร้างโดย ${b.createdBy.name}` : "สร้างโดยผู้ดูแลระบบ"} · {fmt(b.startAt)} ถึง {fmt(b.endAt)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-medium">
                    <span className={`rounded-full px-2.5 py-0.5 ${b.published ? "bg-green-50 text-green-700" : "bg-amber-100 text-amber-800"}`}>{b.published ? "เผยแพร่แล้ว" : "รอแอดมินเผยแพร่"}</span>
                    {!b.active && <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-neutral-500">ปิดแสดงชั่วคราว</span>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {admin && (
                    <form action={setPublished.bind(null, b.id, !b.published)}>
                      <button className={`${iconBtn} ${b.published ? "border-neutral-300" : "border-green-600 bg-green-600 font-semibold text-white"}`}>{b.published ? "ยกเลิกเผยแพร่" : "เผยแพร่"}</button>
                    </form>
                  )}
                  {admin && (
                    <form action={togglePin.bind(null, b.id)}>
                      <button aria-pressed={b.pinned} className={`${iconBtn} ${b.pinned ? "border-amber-400 bg-amber-50 text-amber-700" : "border-neutral-300"}`}>
                        <PinIcon filled={b.pinned} />
                        {b.pinned ? "เลิกปักหมุด" : "ปักหมุด"}
                      </button>
                    </form>
                  )}
                  {manager && (
                    <form action={toggleBanner.bind(null, b.id)}>
                      <button className={`${iconBtn} border-neutral-300`}>{b.active ? "ปิดแสดง" : "เปิดแสดง"}</button>
                    </form>
                  )}
                  {canEdit && <Link href={`/admin/banners/${b.id}`} className={`${iconBtn} border-neutral-300`}>แก้ไข</Link>}
                  {canDelete && (
                    <form action={deleteBanner.bind(null, b.id)}>
                      <button className={`${iconBtn} border-red-200 text-red-600`}>ลบ</button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
