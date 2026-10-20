import { Fragment } from "react";
import { lineParts } from "@/lib/site-texts";

// Thai marks that sit above/below a letter take no width of their own
const NO_WIDTH = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u200B-\u200D]/g;
const EM_PER_CHAR = 0.585; // average advance of Thai/Latin text in Sarabun, with a little spare

/** Visible width of a line, in characters (marks that take no width are not counted). */
export const textUnits = (s: string) => s.replace(NO_WIDTH, "").length;

/**
 * Each line of the text stays on ONE line and the letters shrink to fit the column (never above `maxPx`).
 * Pure CSS: the wrapper is a size container, so the font size is a share of the column width worked out from the longest line;
 * nothing runs in the browser and the text is the same for crawlers and screen readers. "A | B" in the text = two lines.
 */
export default function FitLines({ text, maxPx, className = "" }: { text: string; maxPx: number; className?: string }) {
  const parts = lineParts(text);
  if (parts.length === 0) return null;
  const longest = Math.max(...parts.map(textUnits), 1);
  const size = `min(${maxPx}px, ${(100 / (longest * EM_PER_CHAR)).toFixed(3)}cqw)`;
  return (
    <div className={`w-full ${className}`} style={{ containerType: "inline-size" }}>
      <span className="block whitespace-nowrap leading-snug" style={{ fontSize: size }}>
        {parts.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {p}
          </Fragment>
        ))}
      </span>
    </div>
  );
}
