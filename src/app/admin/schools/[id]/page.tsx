import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireManagerPage } from "@/lib/permissions";
import { fileUrl } from "@/lib/site";
import SchoolForm from "./school-form";

export const dynamic = "force-dynamic";

export default async function EditSchoolPage({ params }: { params: { id: string } }) {
  await requireManagerPage();
  const s = await db.school.findUnique({ where: { id: params.id }, include: { account: { select: { email: true, mustChangePassword: true, active: true } } } });
  if (!s) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/schools" className="text-sm text-brand">← ทำเนียบโรงเรียน</Link>
        <h1 className="text-2xl font-bold">{s.name}</h1>
        <p className="text-sm text-neutral-500">รหัส {s.code} · อ.{s.district} · {s.center}</p>
      </div>
      <SchoolForm
        school={{ id: s.id, code: s.code, name: s.name, district: s.district, center: s.center, email: s.email ?? "", siteUrl: s.siteUrl ?? "", cardSourceUrl: s.cardSourceUrl ?? "", active: s.active, cardUrl: fileUrl(s.cardKey), cardStatus: s.cardStatus, cardError: s.cardError }}
        account={s.account ? { email: s.account.email ?? "", mustChange: s.account.mustChangePassword, active: s.account.active } : null}
      />
    </div>
  );
}
