import Link from "next/link";
import MediaForm from "@/app/dashboard/media/media-form";
import { getFormOptions } from "@/lib/media-data";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { storageIsDurable } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminNewMediaPage() {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const [{ areas, types, levels }, site] = await Promise.all([getFormOptions(), getSiteInfo()]);
  return (
    <div className="space-y-4">
      <Link href="/admin/media" className="text-sm text-brand">← คลังสื่อ</Link>
      <h1 className="text-2xl font-bold">เพิ่มสื่อ</h1>
      <MediaForm
        values={{ title: "", description: "", areaId: "", typeId: "", levelIds: [], tags: "", authorName: "", coverUrl: null, coverDrive: "", coverFx: 0.5, coverFy: 0.5, items: [] }}
        areas={areas} types={types} levels={levels} allowUpload={site.allowServerUploads && storageIsDurable()} isAdmin isStudent={false} doneHref="/admin/media"
      />
    </div>
  );
}
