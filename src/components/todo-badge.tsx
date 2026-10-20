/** Small round number for "courses I have to take". Red when something is due soon or late, amber otherwise. Decorative: the text next to it says the same in words. */
export default function TodoBadge({ count, urgent, className = "" }: { count: number; urgent: boolean; className?: string }) {
  if (count <= 0) return null;
  return (
    <span aria-hidden className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white ${urgent ? "bg-red-500" : "bg-amber-500"} ${className}`}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

export type TodoInfo = { count: number; urgent: boolean };
