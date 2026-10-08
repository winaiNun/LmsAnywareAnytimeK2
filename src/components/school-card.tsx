/* eslint-disable @next/next/no-img-element */
import type { SchoolListItem } from "@/lib/schools-data";

const PALETTE = ["#1E3A8A", "#0F766E", "#9F1239", "#475569", "#7C3AED", "#B45309"];
const colorOf = (s: string) => PALETTE[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];

/** One school: its Anywhere Anytime card picture, name and district/centre. Opens the school's site in a new tab. */
export default function SchoolCard({ school, priority = false }: { school: SchoolListItem; priority?: boolean }) {
  const short = school.name.replace(/^โรงเรียน/, "");

  const body = (
    <>
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-100">
        {school.cardUrl ? (
          <img
            src={school.cardUrl}
            alt={`การ์ด Anywhere Anytime ของ${school.name}`}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-lg font-bold leading-snug text-white" style={{ backgroundColor: colorOf(school.code) }}>
            {short}
          </div>
        )}
        {school.siteUrl && (
          <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug text-neutral-900">{school.name}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500">
          <span>อ.{school.district}</span>
          <span aria-hidden>·</span>
          <span>{school.center}</span>
        </p>
        {!school.siteUrl && <p className="text-xs font-medium text-amber-700">ยังไม่มีลิงก์เว็บไซต์</p>}
      </div>
    </>
  );

  const frame = "group block overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition";
  if (!school.siteUrl) return <div className={`${frame} opacity-80`}>{body}</div>;
  return (
    <a
      href={school.siteUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`เปิดเว็บไซต์ Anywhere Anytime ของ${school.name} (แท็บใหม่)`}
      className={`${frame} hover:-translate-y-0.5 hover:border-brand hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
    >
      {body}
    </a>
  );
}
