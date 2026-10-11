import Link from "next/link";
import { db } from "@/lib/db";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { ReviewersPanel, TaxonomyForm, type TaxItem } from "./taxonomy-client";

export const dynamic = "force-dynamic";

export default async function TaxonomyPage() {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const [areas, types, levels] = await Promise.all([
    db.learningArea.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { media: true } }, reviewers: { include: { user: { select: { name: true, email: true, username: true } } } } } }),
    db.mediaType.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { media: true } } } }),
    db.educationLevel.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { media: true } } } }),
  ]);
  const item = (r: { id: string; slug: string; name: string; sortOrder: number; active: boolean; _count: { media: number } } & { icon?: string; color?: string }): TaxItem => ({ id: r.id, slug: r.slug, name: r.name, icon: r.icon, color: r.color, sortOrder: r.sortOrder, active: r.active, used: r._count.media });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/media" className="text-sm text-brand">← คลังสื่อ</Link>
        <h1 className="text-2xl font-bold">กลุ่มสาระ ประเภทสื่อ ระดับชั้น และผู้ตรวจ</h1>
        <p className="text-sm text-neutral-500">กลุ่มสาระแสดงเป็นเมนูในหน้าแรก · ผู้ตรวจที่แต่งตั้งจะอนุมัติสื่อของกลุ่มสาระนั้นได้ที่เมนู “ตรวจสื่อ” ในบัญชีของตน</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">กลุ่มสาระ</h2>
        {areas.map((a) => (
          <div key={a.id} className="space-y-3 rounded-2xl bg-neutral-50 p-3">
            <TaxonomyForm kind="area" item={item(a)} />
            <ReviewersPanel areaId={a.id} reviewers={a.reviewers.map((r) => ({ userId: r.userId, name: r.user.name, login: r.user.email ?? r.user.username ?? "" }))} />
          </div>
        ))}
        <TaxonomyForm kind="area" item={null} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">ประเภทสื่อ</h2>
        {types.map((t) => <TaxonomyForm key={t.id} kind="type" item={item(t)} />)}
        <TaxonomyForm kind="type" item={null} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">ระดับชั้น</h2>
        {levels.map((l) => <TaxonomyForm key={l.id} kind="level" item={item(l)} />)}
        <TaxonomyForm kind="level" item={null} />
      </section>
    </div>
  );
}
