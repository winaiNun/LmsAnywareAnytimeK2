import Avatar from "@/components/avatar";
import Glyph from "@/components/glyph";
import MediaViewer from "@/components/media-viewer";
import { type FullMedia, coverUrlOf, ownerOf } from "@/lib/media-data";
import { toViewItem } from "@/lib/media-view";
import { formatThaiDate } from "@/lib/thai-date";

/** Title, owner, description and every item of one media (shared by the public page, review pages and admin). */
export default function MediaDetailBody({ media, countMediaId, actions }: { media: FullMedia; countMediaId: string | null; actions?: React.ReactNode }) {
  const owner = ownerOf(media);
  const items = media.items.map((i) => toViewItem({ ...i, html: null }));
  const [main, ...rest] = items;

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-white" style={{ backgroundColor: media.area.color }}><Glyph name={media.area.icon} size={14} />{media.area.name}</span>
          {media.type && <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-neutral-700"><Glyph name={media.type.icon} size={14} />{media.type.name}</span>}
          {media.levels.map((l) => <span key={l.levelId} className="rounded-full bg-brand-soft px-3 py-1 text-brand">{l.level.name}</span>)}
        </div>
        <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{media.title}</h1>
        <div className="flex items-center gap-3 text-sm">
          <Avatar avatar={owner.avatar} name={owner.name} size={44} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{owner.name}</p>
            <p className="truncate text-xs text-neutral-500">{[owner.subtitle, media.publishedAt ? `เผยแพร่ ${formatThaiDate(media.publishedAt)}` : null].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      </header>

      {main ? <MediaViewer item={main} mediaId={countMediaId} cover={coverUrlOf(media)} /> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">สื่อนี้ยังไม่มีรายการให้เปิด</p>}

      {actions}

      {media.description && <p className="whitespace-pre-line leading-relaxed text-neutral-700">{media.description}</p>}

      {rest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">ไฟล์/ลิงก์เพิ่มเติม</h2>
          <div className="space-y-4">
            {rest.map((it) => (
              <div key={it.id} className="space-y-2">
                {it.label && <p className="text-sm font-medium">{it.label}</p>}
                <MediaViewer item={it} mediaId={countMediaId} />
              </div>
            ))}
          </div>
        </section>
      )}

      {media.tags.length > 0 && (
        <p className="flex flex-wrap gap-2 text-sm">{media.tags.map((t) => <span key={t} className="rounded-full border border-neutral-200 px-3 py-1 text-neutral-600">#{t}</span>)}</p>
      )}
    </article>
  );
}
