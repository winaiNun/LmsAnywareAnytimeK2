import type { Metadata } from "next";
import Breadcrumb from "@/components/breadcrumb";
import Glyph from "@/components/glyph";
import SitePageBody from "@/components/site-page-body";
import SiteNavbar from "@/components/site-navbar";
import { getFooterData } from "@/lib/footer-data";
import { getPage, type PageSlug } from "@/lib/site-pages";

export async function infoMetadata(slug: PageSlug): Promise<Metadata> {
  return { title: (await getPage(slug)).title };
}

/** One of the editable text pages (about / contact / privacy / terms / help). The contact page also lists the contact details from the settings. */
export default async function InfoPage({ slug }: { slug: PageSlug }) {
  const page = await getPage(slug);
  const d = slug === "contact" ? await getFooterData() : null;
  const rows = d
    ? [
        d.contact.address && { icon: "map-pin", label: "ที่อยู่", value: d.contact.address, href: null as string | null },
        d.contact.phone && { icon: "phone", label: "โทรศัพท์", value: d.contact.phone, href: `tel:${d.contact.phone.replace(/[^\d+]/g, "")}` },
        d.contact.email && { icon: "mail", label: "อีเมล", value: d.contact.email, href: `mailto:${d.contact.email}` },
        d.social.facebook && { icon: "facebook", label: "Facebook", value: d.social.facebook.replace(/^https:\/\/(www\.)?/, ""), href: d.social.facebook },
        d.social.youtube && { icon: "youtube", label: "YouTube", value: d.social.youtube.replace(/^https:\/\/(www\.)?/, ""), href: d.social.youtube },
        d.social.line && { icon: "chat", label: "LINE", value: d.social.line.replace(/^https:\/\/(www\.)?/, ""), href: d.social.line },
      ].filter((r): r is { icon: string; label: string; value: string; href: string | null } => !!r)
    : [];

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-12 pt-24">
        <Breadcrumb items={[{ label: page.title }]} />
        <h1 className="text-2xl font-bold sm:text-3xl">{page.title}</h1>
        <SitePageBody body={page.body} allowHtml />
        {rows.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {rows.map((r) => {
              const inner = (
                <>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Glyph name={r.icon} size={22} /></span>
                  <span className="min-w-0">
                    <span className="block text-xs text-neutral-500">{r.label}</span>
                    <span className="block whitespace-pre-line break-words font-medium">{r.value}</span>
                  </span>
                </>
              );
              return (
                <li key={r.label}>
                  {r.href ? (
                    <a href={r.href} target={r.href.startsWith("https") ? "_blank" : undefined} rel="noopener noreferrer" className="flex min-h-16 items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 hover:border-brand/40 hover:shadow-sm">{inner}</a>
                  ) : (
                    <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
