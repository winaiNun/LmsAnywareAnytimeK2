import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import MediaDetailBody from "@/components/media-detail";
import { canDecide, canPreviewMedia, canReviewMedia } from "@/lib/media-access";
import { STATUS_LABEL, loadFullMedia } from "@/lib/media-data";
import { getActor } from "@/lib/media-server";
import ReviewPanel from "../review-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตรวจสื่อ" };

/** Preview exactly what the public will see (views are NOT counted here) and decide. */
export default async function ReviewMediaPage({ params }: { params: { id: string } }) {
  const actor = await getActor();
  if (!actor) redirect(`/login?callbackUrl=/dashboard/review/${params.id}`);
  const media = await loadFullMedia(params.id);
  if (!media || !canPreviewMedia(actor, media)) notFound();
  const [label, tone] = STATUS_LABEL[media.status];
  const admin = actor.role === "ADMIN";

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <Link href="/dashboard/review" className="text-sm text-brand">← คิวตรวจสื่อ</Link>
      <p className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{label}</span>
        <span className="text-neutral-500">ตัวอย่างสำหรับผู้ตรวจ — ไม่นับยอดเปิดดู</span></p>
      <ReviewPanel id={media.id} status={media.status} canDecide={canDecide(media.status) && canReviewMedia(actor, media)} isAdmin={admin} pinned={media.pinned} backHref="/dashboard/review" />
      <MediaDetailBody media={media} countMediaId={null} />
    </main>
  );
}
