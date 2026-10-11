import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewPanel from "@/app/dashboard/review/review-panel";
import MediaDetailBody from "@/components/media-detail";
import { STATUS_LABEL, loadFullMedia } from "@/lib/media-data";
import { isAdmin, requireManagerPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminMediaDetailPage({ params }: { params: { id: string } }) {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const media = await loadFullMedia(params.id);
  if (!media) notFound();
  const [label, tone] = STATUS_LABEL[media.status];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/media" className="text-sm text-brand">← คลังสื่อ</Link>
        <Link href={`/admin/media/${media.id}/edit`} className="flex min-h-11 items-center rounded-lg border px-4 text-sm">แก้ไข</Link>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{label}</span>
        <span className="text-neutral-500">โดย {media.createdBy.name} · ดู {media.viewCount} · ถูกใจ {media.likeCount} · ดาวน์โหลด/เปิดลิงก์ {media.downloadCount}</span>
      </p>
      {media.status === "REJECTED" && media.reviewNote && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">เหตุผลที่ส่งกลับ: {media.reviewNote}</p>}
      <ReviewPanel id={media.id} status={media.status} canDecide={media.status === "PENDING"} isAdmin pinned={media.pinned} backHref="/admin/media" />
      <MediaDetailBody media={media} countMediaId={null} />
    </div>
  );
}
