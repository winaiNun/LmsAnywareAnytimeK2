import Link from "next/link";
import { redirect } from "next/navigation";
import Glyph from "@/components/glyph";
import { db } from "@/lib/db";
import { STATUS_LABEL, cardSelect, coverUrlOf } from "@/lib/media-data";
import { getActor } from "@/lib/media-server";
import { formatThaiDate } from "@/lib/thai-date";
import DeleteMediaButton from "./row-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "สื่อของฉัน" };

const SAVED: Record<string, string> = {
  PENDING: "ส่งขออนุมัติแล้ว — สื่อจะแสดงบนเว็บหลังผู้ตรวจอนุมัติ",
  DRAFT: "บันทึกร่างแล้ว",
  PUBLISHED: "เผยแพร่แล้ว",
};

export default async function MyMediaPage({ searchParams }: { searchParams: { saved?: string } }) {
  const actor = await getActor();
  if (!actor) redirect("/login?callbackUrl=/dashboard/media");

  const [items, pendingForMe] = await Promise.all([
    db.media.findMany({ where: { createdById: actor.id }, orderBy: { updatedAt: "desc" }, select: { ...cardSelect, reviewNote: true } }),
    actor.reviewerAreaIds.length || actor.role === "ADMIN"
      ? db.media.count({ where: { status: "PENDING", createdById: { not: actor.id }, ...(actor.role === "ADMIN" ? {} : { areaId: { in: actor.reviewerAreaIds } }) } })
      : Promise.resolve(0),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-brand">← บัญชีของฉัน</Link>
          <h1 className="text-2xl font-bold">สื่อของฉัน</h1>
        </div>
        <div className="flex gap-2">
          {(actor.reviewerAreaIds.length > 0 || actor.role === "ADMIN") && (
            <Link href="/dashboard/review" className="flex min-h-11 items-center rounded-lg border px-4 text-sm">ตรวจสื่อ{pendingForMe > 0 ? ` (${pendingForMe})` : ""}</Link>
          )}
          <Link href="/dashboard/media/new" className="flex min-h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white">+ เพิ่มสื่อ</Link>
        </div>
      </div>

      {searchParams.saved && SAVED[searchParams.saved] && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">{SAVED[searchParams.saved]}</p>}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="font-semibold">ยังไม่มีสื่อ</p>
          <p className="mt-1 text-sm text-neutral-500">แชร์คลิป YouTube ไฟล์จาก Drive หรือแอป HTML ให้คนอื่นใช้ได้</p>
          <Link href="/dashboard/media/new" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white">เพิ่มสื่อชิ้นแรก</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => {
            const [label, tone] = STATUS_LABEL[m.status];
            const cover = coverUrlOf(m);
            return (
              <li key={m.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
                <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg sm:w-36" style={{ backgroundColor: m.area.color }}>
                  {cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" style={{ objectPosition: `${m.coverFx * 100}% ${m.coverFy * 100}%` }} />
                    : <span className="flex h-full items-center justify-center text-white"><Glyph name={m.area.icon} size={30} strokeWidth={1.4} /></span>}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-2 font-semibold leading-snug">{m.title}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span className={`rounded-full px-2.5 py-0.5 font-medium ${tone}`}>{label}</span>
                    <span>{m.area.name}</span>
                    <span>แก้ไข {formatThaiDate(m.updatedAt)}</span>
                    {m.status === "PUBLISHED" && <span className="inline-flex items-center gap-2"><span className="inline-flex items-center gap-1"><Glyph name="eye" size={13} />{m.viewCount}</span><span className="inline-flex items-center gap-1"><Glyph name="heart" size={13} />{m.likeCount}</span></span>}
                  </p>
                  {m.status === "REJECTED" && m.reviewNote && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">ส่งกลับ: {m.reviewNote}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link href={`/dashboard/media/${m.id}`} className="flex min-h-10 items-center rounded-lg border border-neutral-300 px-3 text-sm">แก้ไข</Link>
                    {m.status === "PUBLISHED" && <Link href={`/library/${m.id}`} className="flex min-h-10 items-center rounded-lg border border-neutral-300 px-3 text-sm">ดูหน้าสื่อ</Link>}
                    <DeleteMediaButton id={m.id} title={m.title} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
