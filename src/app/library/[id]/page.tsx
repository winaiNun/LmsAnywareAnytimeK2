import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Avatar from "@/components/avatar";
import Breadcrumb from "@/components/breadcrumb";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";
import Glyph from "@/components/glyph";
import MediaDetailBody from "@/components/media-detail";
import { MediaGrid } from "@/components/media-card";
import SiteNavbar from "@/components/site-navbar";
import { db } from "@/lib/db";
import { canPreviewMedia, showsOwnerIdentity } from "@/lib/media-access";
import { STATUS_LABEL, cardSelect, coverUrlOf, loadFullMedia, ownerOf, toCard } from "@/lib/media-data";
import { getActor } from "@/lib/media-server";
import { LikeButton, ShareButton, ViewCounter } from "./media-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const m = await db.media.findFirst({ where: { id: params.id, status: "PUBLISHED" }, select: { title: true, description: true, coverKey: true, coverDriveId: true } });
  if (!m) return { title: "คลังสื่อการเรียนรู้" };
  const image = coverUrlOf(m);
  return { title: m.title, description: m.description.slice(0, 160) || "สื่อการเรียนรู้", openGraph: { title: m.title, description: m.description.slice(0, 160), ...(image ? { images: [image] } : {}) } };
}

const nf = new Intl.NumberFormat("th-TH");

export default async function MediaPage({ params }: { params: { id: string } }) {
  const [actor, media, texts] = await Promise.all([getActor(), loadFullMedia(params.id), getSiteTexts()]);
  if (!media) notFound();
  const published = media.status === "PUBLISHED";
  if (!published && !canPreviewMedia(actor, media)) notFound(); // drafts / pending items look like they do not exist

  const [liked, related, ownerCount] = await Promise.all([
    actor && published ? db.mediaLike.findUnique({ where: { userId_mediaId: { userId: actor.id, mediaId: media.id } }, select: { userId: true } }).then(Boolean) : Promise.resolve(false),
    db.media.findMany({ where: { status: "PUBLISHED", areaId: media.areaId, id: { not: media.id } }, orderBy: [{ viewCount: "desc" }, { publishedAt: "desc" }], take: 4, select: cardSelect }),
    showsOwnerIdentity(media.createdBy.memberType) ? db.media.count({ where: { createdById: media.createdById, status: "PUBLISHED" } }) : Promise.resolve(0),
  ]);
  const owner = ownerOf(media);
  const [statusLabel, statusTone] = STATUS_LABEL[media.status];

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-5xl space-y-8 px-4 pb-28 pt-24 md:pb-16">
        <Breadcrumb items={[{ label: plainText(texts["nav.library"]), href: "/library" }, { label: media.area.name, href: `/library?area=${media.area.slug}` }, { label: media.title.length > 40 ? `${media.title.slice(0, 40)}…` : media.title }]} />

        {!published && (
          <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            ตัวอย่างสำหรับ{actor?.id === media.createdById ? "เจ้าของสื่อ" : "ผู้ตรวจ"} — สื่อนี้ยังไม่เผยแพร่ (สถานะ <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone}`}>{statusLabel}</span>) คนอื่นจะยังไม่เห็นหน้านี้ และยอดเปิดดูไม่ถูกนับ
          </p>
        )}

        <ViewCounter mediaId={media.id} enabled={published} />
        <MediaDetailBody
          media={media}
          countMediaId={published ? media.id : null}
          actions={
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <LikeButton mediaId={media.id} initialLiked={liked} initialCount={media.likeCount} enabled={published} />
              <ShareButton title={media.title} />
              <span className="ml-auto flex items-center gap-4 text-sm text-neutral-500 tabular-nums">
                <span className="inline-flex items-center gap-1.5" title="จำนวนครั้งที่เปิดดู"><Glyph name="eye" size={16} />{nf.format(media.viewCount)} ครั้ง</span>
                {media.downloadCount > 0 && <span className="inline-flex items-center gap-1.5" title="ดาวน์โหลด/เปิดลิงก์ต้นทาง"><Glyph name="download" size={16} />{nf.format(media.downloadCount)}</span>}
              </span>
            </div>
          }
        />

        {showsOwnerIdentity(media.createdBy.memberType) && (
          <section aria-label="ผู้จัดทำ" className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4">
            <Avatar avatar={owner.avatar} name={owner.name} size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-500">ผู้จัดทำ</p>
              <p className="truncate font-semibold">{owner.name}</p>
              {owner.subtitle && <p className="truncate text-sm text-neutral-500">{owner.subtitle}</p>}
            </div>
            {ownerCount > 1 && !media.authorName && (
              <Link href={`/library?by=${media.createdById}`} className="flex min-h-11 shrink-0 items-center rounded-xl border border-neutral-300 px-4 text-sm font-semibold hover:bg-neutral-50">สื่ออื่นของผู้นี้ ({ownerCount})</Link>
            )}
          </section>
        )}

        {related.length > 0 && (
          <section className="space-y-3" aria-label="สื่อใกล้เคียง">
            <h2 className="text-lg font-semibold">สื่อใน{media.area.name}</h2>
            <MediaGrid items={related.map(toCard)} />
          </section>
        )}
      </main>
    </>
  );
}
