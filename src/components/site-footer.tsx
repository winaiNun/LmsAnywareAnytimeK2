import Link from "next/link";
import FooterGate from "@/components/footer-gate";
import Glyph from "@/components/glyph";
import { getFooterData } from "@/lib/footer-data";
import { formatThaiDate, bangkokParts } from "@/lib/thai-date";

const nf = new Intl.NumberFormat("th-TH");
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

const QUICK = [
  { href: "/", label: "หน้าแรก" },
  { href: "/library", label: "คลังสื่อการเรียนรู้" },
  { href: "/#courses", label: "คอร์สเรียน" },
  { href: "/schools", label: "ทำเนียบโรงเรียน" },
  { href: "/resources", label: "แหล่งสื่อภายนอก" },
  { href: "/about", label: "เกี่ยวกับระบบ" },
  { href: "/contact", label: "ติดต่อเรา" },
];

const heading = "mb-4 text-sm font-semibold uppercase tracking-wider text-white/60";
const link = "inline-flex min-h-9 items-center text-[15px] text-white/85 transition hover:text-white hover:underline hover:underline-offset-4";

function Stat({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-[calc(50%-0.375rem)] items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.07] px-3 py-3 backdrop-blur-sm sm:px-4 lg:w-56">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/12 text-white">
        <Glyph name={icon} size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight text-white">{children}</p>
        <p className="text-xs leading-tight text-white/65">{label}</p>
      </div>
    </div>
  );
}

/** The site footer for every public page: counters, quick links, outside sources, contact and legal links. Hidden in the back office and on sign-in/up. */
export default async function SiteFooter() {
  const d = await getFooterData();
  const { site, contact, social, resources, stats } = d;
  const year = bangkokParts(new Date()).year + 543;
  const socials = [
    { key: "facebook", label: "Facebook", href: social.facebook },
    { key: "youtube", label: "YouTube", href: social.youtube },
    { key: "chat", label: "LINE", href: social.line },
  ].filter((s): s is { key: string; label: string; href: string } => !!s.href);
  const hasContact = !!(contact.address || contact.phone || contact.email);

  return (
    <FooterGate>
      <footer className="relative mt-10 overflow-hidden bg-gradient-to-b from-[#0B2A6F] to-[#061a4a] text-white" aria-label="ท้ายเว็บ">
        <div className="pointer-events-none absolute -left-28 -top-24 h-80 w-80 rounded-full bg-[#0052FF]/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-[#4F8BFF]/15 blur-3xl" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4F8BFF] via-[#0052FF] to-[#7C3AED]" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-12 md:pb-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1.2fr]">
            <div>
              <Link href="/" className="inline-flex items-center gap-3" aria-label={`${site.systemName} — หน้าแรก`}>
                {site.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={site.logoUrl} alt="" className="h-14 w-auto max-w-[120px] object-contain" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><Glyph name="book-open" size={26} /></span>
                )}
                <span className="text-lg font-bold leading-tight">{site.systemName}</span>
              </Link>
              {site.areaName && <p className="mt-3 text-[15px] font-medium text-white/90">{site.areaName}</p>}
              {site.tagline && <p className="mt-1 max-w-xs text-sm leading-relaxed text-white/65">{site.tagline}</p>}
              {socials.length > 0 && (
                <ul className="mt-5 flex gap-2.5">
                  {socials.map((s) => (
                    <li key={s.key}>
                      <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 transition hover:-translate-y-0.5 hover:bg-white hover:text-[#0B2A6F]">
                        <Glyph name={s.key} size={20} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <nav aria-label="เมนูลัด">
              <h2 className={heading}>เมนูลัด</h2>
              <ul>
                {QUICK.map((q) => <li key={q.href}><Link href={q.href} className={link}>{q.label}</Link></li>)}
              </ul>
            </nav>

            <nav aria-label="แหล่งสื่อภายนอก">
              <h2 className={heading}>แหล่งสื่อภายนอก</h2>
              {resources.length === 0 ? (
                <p className="text-sm text-white/60">ยังไม่มีรายการ</p>
              ) : (
                <ul>
                  {resources.map((r) => (
                    <li key={r.id}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className={`${link} max-w-full gap-2`} title={hostOf(r.url)}>
                        <span className="min-w-0 truncate">{r.name}</span>
                        <Glyph name="external-link" size={13} className="shrink-0 opacity-60" />
                      </a>
                    </li>
                  ))}
                  <li><Link href="/resources" className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-[#9CC0FF] hover:text-white">ดูทั้งหมด<Glyph name="chevron-right" size={14} strokeWidth={2.2} /></Link></li>
                </ul>
              )}
            </nav>

            <div>
              <h2 className={heading}>ติดต่อ</h2>
              {hasContact ? (
                <ul className="space-y-3 text-[15px] text-white/85">
                  {contact.address && <li className="flex gap-3"><Glyph name="map-pin" size={18} className="mt-0.5 shrink-0 text-white/60" /><span className="whitespace-pre-line">{contact.address}</span></li>}
                  {contact.phone && <li className="flex gap-3"><Glyph name="phone" size={18} className="mt-0.5 shrink-0 text-white/60" /><a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">{contact.phone}</a></li>}
                  {contact.email && <li className="flex gap-3"><Glyph name="mail" size={18} className="mt-0.5 shrink-0 text-white/60" /><a href={`mailto:${contact.email}`} className="break-all hover:underline">{contact.email}</a></li>}
                </ul>
              ) : (
                <p className="text-sm text-white/60">ดูช่องทางติดต่อได้ที่หน้า “ติดต่อเรา”</p>
              )}
              <Link href="/contact" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-semibold transition hover:bg-white hover:text-[#0B2A6F]">
                ติดต่อเรา<Glyph name="chevron-right" size={15} strokeWidth={2.2} />
              </Link>
            </div>
          </div>

          {stats.showVisits && (
            <section aria-label="สถิติการเข้าชม" className="mt-10">
              <div className="flex flex-wrap justify-center gap-3">
                <Stat icon="users" label="ผู้เข้าชมวันนี้">{nf.format(stats.today)}</Stat>
                <Stat icon="calendar-check" label="ผู้เข้าชมเดือนนี้">{nf.format(stats.month)}</Stat>
                <Stat icon="eye" label="ผู้เข้าชมทั้งหมด">{nf.format(stats.total)}</Stat>
              </div>
              <p className="mt-3 text-center text-xs text-white/60">นับผู้เข้าชมไม่ซ้ำรายวัน ตั้งแต่ {formatThaiDate(new Date(stats.since), { style: "long" })}</p>
            </section>
          )}

          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/15 pt-6 text-sm text-white/65 md:flex-row">
            <p className="text-center md:text-left">© {year} {site.systemName}{site.areaName ? ` · ${site.areaName}` : ""}</p>
            <ul className="flex flex-wrap justify-center gap-x-5">
              <li><Link href="/privacy" className="inline-flex min-h-9 items-center hover:text-white">นโยบายความเป็นส่วนตัว</Link></li>
              <li><Link href="/terms" className="inline-flex min-h-9 items-center hover:text-white">เงื่อนไขการใช้งาน</Link></li>
              <li><Link href="/help" className="inline-flex min-h-9 items-center hover:text-white">วิธีใช้งาน</Link></li>
              <li><Link href="/login" className="inline-flex min-h-9 items-center hover:text-white">เข้าสู่ระบบ</Link></li>
            </ul>
          </div>

          {/* designer's credit: hard-coded on purpose, faint, centred, not shown on phones */}
          <p className="mt-5 hidden text-center text-[11px] leading-relaxed text-white/35 md:block">
            พัฒนาและออกแบบระบบ : ศน.วินัย หนุนกระโทก ศึกษานิเทศก์ชำนาญการพิเศษ
          </p>
        </div>
      </footer>
    </FooterGate>
  );
}
