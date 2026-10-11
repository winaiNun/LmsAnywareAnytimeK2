import Link from "next/link";
import { parseBody, type Inline } from "@/lib/site-pages";

function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.href ? (
          p.href.startsWith("/") ? (
            <Link key={i} href={p.href} className="font-medium text-brand underline underline-offset-2">{p.text}</Link>
          ) : (
            <a key={i} href={p.href} target={p.href.startsWith("https") ? "_blank" : undefined} rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-2">{p.text}</a>
          )
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Renders the safe page markup as real elements (never raw HTML). */
export default function SitePageBody({ body }: { body: string }) {
  return (
    <div className="space-y-4 leading-relaxed text-neutral-700">
      {parseBody(body).map((b, i) =>
        b.type === "h" ? (
          <h2 key={i} className="pt-3 text-xl font-bold text-neutral-900">{b.text}</h2>
        ) : b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1.5 pl-6 marker:text-brand">
            {b.items.map((it, j) => <li key={j}><Inlines parts={it} /></li>)}
          </ul>
        ) : (
          <p key={i}><Inlines parts={b.inline} /></p>
        ),
      )}
    </div>
  );
}
