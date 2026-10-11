"use client";

import Glyph from "@/components/glyph";
import ResourceIcon from "@/components/resource-icon";
import type { AvatarData } from "@/lib/avatar";

export type ResourceCardData = { id: string; name: string; url: string; description: string | null; groupName: string; icon: string; color: string; image: AvatarData | null };

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/**
 * One outside source: opens in a new tab and counts the click (sendBeacon, never delays the click).
 * Fixed height with the name and the description clamped to two lines, so every card is exactly the same size.
 */
export default function ResourceCard({ r }: { r: ResourceCardData }) {
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => { try { navigator.sendBeacon(`/api/resources/${r.id}/open`); } catch {} }}
      className="group flex h-40 gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
    >
      <ResourceIcon image={r.image} icon={r.icon} color={r.color} size={52} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 font-semibold leading-snug group-hover:text-brand" title={r.name}>{r.name}</span>
          <Glyph name="external-link" size={16} className="mt-1 shrink-0 text-neutral-400 group-hover:text-brand" />
        </span>
        <span className="mt-1 line-clamp-2 min-h-[2.75rem] text-sm leading-snug text-neutral-600">{r.description ?? ""}</span>
        <span className="mt-auto flex items-center gap-2 text-xs text-neutral-500">
          <span className="shrink-0 rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: `${r.color}1A`, color: r.color }}>{r.groupName}</span>
          <span className="truncate">{hostOf(r.url)}</span>
        </span>
      </span>
    </a>
  );
}
