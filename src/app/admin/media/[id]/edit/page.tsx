import Link from "next/link";
import { notFound } from "next/navigation";
import MediaForm from "@/app/dashboard/media/media-form";
import { formValuesOf, getFormOptions, loadEditMedia } from "@/lib/media-data";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { storageIsDurable } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminEditMediaPage({ params }: { params: { id: string } }) {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const [media, opts, site] = await Promise.all([loadEditMedia(params.id), getFormOptions(), getSiteInfo()]);
  if (!media) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/admin/media/${media.id}`} className="text-sm text-brand">← ดูตัวอย่าง/ตรวจ</Link>
      <h1 className="text-2xl font-bold">แก้ไขสื่อ</h1>
      <MediaForm values={formValuesOf(media)} {...opts} allowUpload={site.allowServerUploads && storageIsDurable()} isAdmin isStudent={false} doneHref="/admin/media" />
    </div>
  );
}
