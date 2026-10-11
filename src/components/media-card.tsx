import Link from "next/link";
import Avatar from "@/components/avatar";
import type { MediaCardData } from "@/lib/media-data";

const nf = new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 });

/**
 * One media card: 16:9 cover (area colour + emoji when there is no picture), title, area, and a footer with the
 * owner's round profile picture + name on the left and views / likes on the right. The whole card is one link.
 */
export default function MediaCard({ card, compact = false, href }: { card: MediaCardData; compact?: boolean; href?: string }) {
  const avatarSize = compact ? 24 : 28;
  return (
    <Link href={href ?? `/library/${card.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
      <div className="relative aspect-video w-full overflow-hidden" style={{ backgroundColor: card.area.color }}>
        {card.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.coverUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" style={{ objectPosition: `${card.coverFx * 100}% ${card.coverFy * 100}%` }} />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/25 to-black/20 text-5xl drop-shadow" aria-hidden>{card.area.icon}</span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">{card.badge}</span>
        {card.pinned && <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-neutral-900" aria-label="ปักหมุด">📌</span>}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className={`line-clamp-2 font-semibold leading-snug text-neutral-900 ${compact ? "text-sm" : "text-[15px]"}`}>{card.title}</h3>
        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: card.area.color }} aria-hidden />
          <span className="truncate">{card.area.name}{card.typeName ? ` · ${card.typeName}` : ""}</span>
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar avatar={card.owner.avatar} name={card.owner.name} size={avatarSize} />
            <span className="truncate font-medium text-neutral-700">{card.owner.name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2.5 tabular-nums" aria-label={`เปิดดู ${card.views} ครั้ง ถูกใจ ${card.likes}`}>
            <span>👁 {nf.format(card.views)}</span>
            <span>♥ {nf.format(card.likes)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Responsive grid shared by the library page and "related media". */
export function MediaGrid({ items }: { items: MediaCardData[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {items.map((c) => <li key={c.id}><MediaCard card={c} /></li>)}
    </ul>
  );
}
