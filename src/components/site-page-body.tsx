import Link from "next/link";
import { ContentDrive, ContentHtml, ContentImage } from "@/components/content-blocks";
import { parseBody, type Inline } from "@/lib/page-markup";

const fileSrc = (key: string) => `/api/files/${key}`;

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

/** Renders the page markup as real elements; pasted HTML only inside a sandboxed frame, and only where `allowHtml` is set. */
export default function SitePageBody({ body, compact = false, allowHtml = false }: { body: string; compact?: boolean; allowHtml?: boolean }) {
  return (
    <div className={compact ? "space-y-2 text-sm leading-relaxed" : "space-y-4 leading-relaxed text-neutral-700"}>
      {parseBody(body, { allowHtml }).map((b, i) =>
        b.type === "h" ? (
          <h2 key={i} className={compact ? "pt-1 text-base font-bold" : "pt-3 text-xl font-bold text-neutral-900"}>{b.text}</h2>
        ) : b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1.5 pl-6 marker:text-brand">
            {b.items.map((it, j) => <li key={j}><Inlines parts={it} /></li>)}
          </ul>
        ) : b.type === "img" ? (
          <ContentImage key={i} src={fileSrc(b.key)} alt={b.alt} />
        ) : b.type === "drive" ? (
          <ContentDrive key={i} id={b.id} thumbSrc={b.thumbKey ? fileSrc(b.thumbKey) : null} title={b.title} />
        ) : b.type === "html" ? (
          <ContentHtml key={i} code={b.code} />
        ) : (
          <p key={i}><Inlines parts={b.inline} /></p>
        ),
      )}
    </div>
  );
}
