import { db } from "@/lib/db";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { DEFAULT_PAGES, PAGE_META, PAGE_SLUGS } from "@/lib/site-pages";
import { resolveTexts } from "@/lib/site-texts";
import { FooterSettingsForm, PageEditor, TextsForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "หน้าข้อมูลและ Footer" };

export default async function PagesAdmin() {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const [site, rows] = await Promise.all([db.siteSetting.findUnique({ where: { id: "main" } }), db.sitePage.findMany()]);
  const pages = PAGE_SLUGS.map((slug) => {
    const row = rows.find((r) => r.slug === slug);
    return { slug, label: PAGE_META[slug].label, path: PAGE_META[slug].path, title: row?.title ?? DEFAULT_PAGES[slug].title, body: row?.body ?? DEFAULT_PAGES[slug].body, custom: !!row };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">หน้าข้อมูลและ Footer</h1>
        <p className="text-sm text-neutral-500">ช่องทางติดต่อ ตัวนับผู้เข้าชม ชื่อเมนู/หัวข้อหน้า และข้อความของหน้า เกี่ยวกับ / ติดต่อ / นโยบายความเป็นส่วนตัว / เงื่อนไข / วิธีใช้งาน</p>
      </div>
      <FooterSettingsForm
        v={{
          contactAddress: site?.contactAddress ?? "", contactPhone: site?.contactPhone ?? "", contactEmail: site?.contactEmail ?? "",
          facebookUrl: site?.facebookUrl ?? "", youtubeUrl: site?.youtubeUrl ?? "", lineUrl: site?.lineUrl ?? "",
          counterBase: site?.counterBase ?? 0, counterSince: (site?.counterSince ?? new Date()).toISOString(),
          showVisits: site?.showVisits ?? true,
        }}
      />
      <TextsForm saved={resolveTexts(site?.texts)} />
      <PageEditor pages={pages} uploadsOpen={site?.allowServerUploads ?? false} />
    </div>
  );
}
