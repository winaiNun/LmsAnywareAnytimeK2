import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { STATUS_LABEL, cardSelect } from "@/lib/media-data";
import { getActor } from "@/lib/media-server";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตรวจสื่อ" };

export default async function ReviewQueuePage() {
  const actor = await getActor();
  if (!actor) redirect("/login?callbackUrl=/dashboard/review");
  const admin = actor.role === "ADMIN";
  if (!admin && actor.reviewerAreaIds.length === 0) redirect("/dashboard");

  const [queue, areas] = await Promise.all([
    db.media.findMany({
      where: { status: "PENDING", ...(admin ? {} : { areaId: { in: actor.reviewerAreaIds } }) },
      orderBy: { updatedAt: "asc" },
      select: cardSelect,
    }),
    db.learningArea.findMany({ where: { id: { in: actor.reviewerAreaIds } }, select: { name: true } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <Link href="/dashboard/media" className="text-sm text-brand">← สื่อของฉัน</Link>
        <h1 className="text-2xl font-bold">ตรวจสื่อ</h1>
        <p className="text-sm text-neutral-500">{admin ? "ทุกกลุ่มสาระ" : `คุณดูแลกลุ่มสาระ: ${areas.map((a) => a.name).join(", ")}`} · รอตรวจ {queue.length} ชิ้น (เรียงจากที่รอนานที่สุด)</p>
      </div>
      {queue.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">ไม่มีสื่อรออนุมัติ 🎉</p>
      ) : (
        <ul className="space-y-3">
          {queue.map((m) => (
            <li key={m.id}>
              <Link href={`/dashboard/review/${m.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-brand">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{m.title}</span>
                  <span className="block text-xs text-neutral-500">{m.area.icon} {m.area.name} · {m.createdBy.name} · ส่งเมื่อ {formatThaiDate(m.updatedAt)}{m.createdBy.id === actor.id ? " · ของคุณเอง" : ""}</span>
                </span>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_LABEL.PENDING[1]}`}>ตรวจ →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
