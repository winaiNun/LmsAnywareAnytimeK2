import { ICON_PATHS, isIconKey } from "@/lib/icon-paths";

type Props = { name: string; className?: string; size?: number; strokeWidth?: number; filled?: boolean };

/** A line icon from `src/lib/icon-paths.ts`. Unknown names (e.g. an old emoji) fall back to a book. */
export default function Glyph({ name, className = "h-5 w-5", size, strokeWidth = 1.7, filled = false }: Props) {
  const d = isIconKey(name) ? ICON_PATHS[name] : ICON_PATHS["book-open"];
  return (
    <svg
      viewBox="0 0 24 24"
      className={size ? undefined : className}
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/** A rounded tile with the icon in the subject colour (soft tint, or solid with `solid`). */
export function IconTile({ name, color, size = 44, solid = false, className = "" }: { name: string; color: string; size?: number; solid?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl ${className}`}
      style={{ width: size, height: size, backgroundColor: solid ? color : `${color}1F`, color: solid ? "#fff" : color }}
      aria-hidden
    >
      <Glyph name={name} size={Math.round(size * 0.52)} strokeWidth={1.6} />
    </span>
  );
}
