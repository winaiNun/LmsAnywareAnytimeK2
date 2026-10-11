import Link from "next/link";
import Glyph from "@/components/glyph";

export type Crumb = { label: string; href?: string };

/**
 * "หน้าแรก › คลังสื่อ › กลุ่มสาระ": tells a visitor where they are and gives a plain, labelled way back to the home page
 * (the logo and the menu work too, but not everyone knows to try them). The first crumb is always the home page with a house icon.
 */
export default function Breadcrumb({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: "หน้าแรก", href: "/" }, ...items];
  return (
    <nav aria-label="เส้นทาง" className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ol className="flex min-h-9 items-center gap-1 whitespace-nowrap text-sm text-neutral-500">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <Glyph name="chevron-right" size={14} className="shrink-0 text-neutral-400" />}
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-neutral-800" : ""}>{c.label}</span>
              ) : (
                <Link href={c.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1.5 font-medium text-brand hover:bg-brand-soft">
                  {i === 0 && <Glyph name="home" size={16} />}
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
