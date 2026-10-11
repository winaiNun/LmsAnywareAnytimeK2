/**
 * Card grid whose last, incomplete row is centred (a plain CSS grid would leave it hugging the left edge).
 * Rows are flex-wrapped and centred; every item gets the exact width a column of the matching grid would have,
 * so full rows look identical to the old grid. The widths are spelled out in full so Tailwind can see them.
 */
const VARIANTS = {
  // 1 / 2 / 3 columns, gap 12px
  resources: { gap: "gap-3", item: "w-full sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-1.5rem)/3)]" },
  // 2 / 3 / 5 columns, gap 12px
  areas: { gap: "gap-3", item: "w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-3rem)/5)]" },
  // 2 / 3 / 4 columns, gap 12px (16px from sm)
  schools: { gap: "gap-3 sm:gap-4", item: "w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]" },
} as const;

export type CenterGridVariant = keyof typeof VARIANTS;

export default function CenterGrid({ variant, items }: { variant: CenterGridVariant; items: { key: string; node: React.ReactNode }[] }) {
  const v = VARIANTS[variant];
  return (
    <ul className={`flex flex-wrap justify-center ${v.gap}`}>
      {items.map((it) => (
        <li key={it.key} className={`min-w-0 ${v.item}`}>{it.node}</li>
      ))}
    </ul>
  );
}
