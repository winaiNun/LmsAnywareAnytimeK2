import Link from "next/link";
import Glyph, { IconTile } from "@/components/glyph";
import { HEADING_SIZE, type HEADING_STYLES } from "@/lib/section-styles";

export type HeadingProps = {
  id?: string;
  style: (typeof HEADING_STYLES)[number];
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** colour of the label, the accent line and the arrow link (hex) */
  accent: string;
  align: "left" | "center" | "right";
  size: "sm" | "md" | "lg";
  /** the title colour the admin picked; the default dark colour is swapped for a navy → accent gradient */
  titleColor: string;
  moreHref?: string | null;
  moreLabel?: string;
  icon?: string;
  /** true when the section background is dark (light text) */
  onDark?: boolean;
};

const DEFAULT_TITLE = "#1E1E1E";
const NAVY = "#0B2A6F";

/**
 * The block heading of a home-page section. Four looks (chosen per section in the admin):
 *  accent = small label + gradient title + short accent bar + "see all" link (default)
 *  icon   = icon tile on the left of the title
 *  center = centred title between two fading rules
 *  plain  = just the text (the original look)
 * Pure markup (no hooks), so the admin preview can render the very same component.
 */
export default function SectionHeading(p: HeadingProps) {
  const dark = !!p.onDark;
  const titleStyle =
    p.style === "accent" && !dark && p.titleColor.toUpperCase() === DEFAULT_TITLE
      ? { backgroundImage: `linear-gradient(90deg, ${NAVY}, ${p.accent})`, WebkitBackgroundClip: "text" as const, backgroundClip: "text" as const, color: "transparent" }
      : { color: dark ? "#fff" : p.titleColor };
  const muted = dark ? "text-white/80" : "text-neutral-500";

  const title = (
    <h2 id={p.id} className={`font-bold leading-tight tracking-tight ${HEADING_SIZE[p.size]}`} style={titleStyle}>
      {p.title}
    </h2>
  );
  const sub = p.subtitle ? <p className={`mt-1.5 max-w-2xl text-[15px] leading-relaxed ${muted}`}>{p.subtitle}</p> : null;
  const label = p.eyebrow ? (
    <span
      className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide"
      style={dark ? { backgroundColor: "rgba(255,255,255,.18)", color: "#fff" } : { backgroundColor: `${p.accent}1A`, color: p.accent }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dark ? "#fff" : p.accent }} aria-hidden />
      {p.eyebrow}
    </span>
  ) : null;
  const more = p.moreHref ? (
    <Link
      href={p.moreHref}
      className="group inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition hover:shadow-sm"
      style={dark ? { borderColor: "rgba(255,255,255,.5)", color: "#fff" } : { borderColor: `${p.accent}55`, color: p.accent }}
    >
      {p.moreLabel ?? "ดูทั้งหมด"}
      <Glyph name="chevron-right" size={16} strokeWidth={2.2} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  ) : null;
  const bar = <span className="mt-3 block h-1 w-14 rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${dark ? "#fff" : p.accent}, ${dark ? "rgba(255,255,255,.2)" : `${p.accent}33`})` }} aria-hidden />;
  const alignClass = p.align === "center" ? "items-center text-center" : p.align === "right" ? "items-end text-right" : "items-start text-left";
  const barAlign = p.align === "center" ? "mx-auto" : p.align === "right" ? "ml-auto" : "";

  if (p.style === "plain") {
    return (
      <header className={p.align === "center" ? "text-center" : p.align === "right" ? "text-right" : "text-left"}>
        {title}
        {p.subtitle && <p className="mt-1 opacity-80">{p.subtitle}</p>}
      </header>
    );
  }

  if (p.style === "center") {
    const rule = (flip: boolean) => <span className="hidden h-px flex-1 sm:block" style={{ backgroundImage: `linear-gradient(${flip ? "270deg" : "90deg"}, transparent, ${dark ? "rgba(255,255,255,.55)" : `${p.accent}66`})` }} aria-hidden />;
    return (
      <header className="flex flex-col items-center text-center">
        {label}
        <div className="flex w-full items-center gap-5">{rule(false)}{title}{rule(true)}</div>
        {sub}
        {more && <div className="mt-4">{more}</div>}
      </header>
    );
  }

  if (p.style === "icon") {
    return (
      <header className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <IconTile name={p.icon ?? "book-open"} color={dark ? "#FFFFFF" : p.accent} size={52} solid={!dark} className={dark ? "bg-white/20 !text-white" : "shadow-sm"} />
          <div className="min-w-0">
            {p.eyebrow && <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider" style={{ color: dark ? "rgba(255,255,255,.8)" : p.accent }}>{p.eyebrow}</p>}
            {title}
            {sub}
          </div>
        </div>
        {more && <div className="hidden sm:block">{more}</div>}
      </header>
    );
  }

  // accent (default)
  return (
    <header className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${p.align === "right" ? "flex-row-reverse" : ""}`}>
      <div className={`flex min-w-0 flex-col ${alignClass}`}>
        {label}
        {title}
        {sub}
        <span className={barAlign}>{bar}</span>
      </div>
      {more && <div className={p.align === "center" ? "mx-auto" : ""}>{more}</div>}
    </header>
  );
}
