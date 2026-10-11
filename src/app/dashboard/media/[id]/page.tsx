import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canEditMedia } from "@/lib/media-access";
import { formValuesOf, getFormOptions, loadFullMedia, STATUS_LABEL } from "@/lib/media-data";
import { getActor } from "@/lib/media-server";
import { storageIsDurable } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";
import MediaForm from "../media-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "แก้ไขสื่อ" };

export default async function EditMediaPage({ params }: { params: { id: string } }) {
  const actor = await getActor();
  if (!actor) redirect(`/login?callbackUrl=/dashboard/media/${params.id}`);
  const media = await loadFullMedia(params.id);
  if (!media || !canEditMedia(actor, media)) notFound();
  const [{ areas, types, levels }, site] = await Promise.all([getFormOptions(), getSiteInfo()]);
  const [label, tone] = STATUS_LABEL[media.status];
  const admin = actor.role === "ADMIN";

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <Link href={admin ? "/admin/media" : "/dashboard/media"} className="text-sm text-brand">← {admin ? "คลังสื่อ" : "สื่อของฉัน"}</Link>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold">แก้ไขสื่อ <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{label}</span></h1>
        {media.status === "PUBLISHED" && !admin && <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">สื่อนี้เผยแพร่อยู่ — หากบันทึกการแก้ไข สื่อจะกลับไปรออนุมัติและหายจากหน้าเว็บชั่วคราวจนกว่าผู้ตรวจจะอนุมัติ</p>}
      </div>
      <MediaForm
        values={formValuesOf(media)}
        areas={areas} types={types} levels={levels}
        allowUpload={site.allowServerUploads && storageIsDurable()}
        isAdmin={admin}
        isStudent={actor.memberType === "STUDENT" && !admin}
        doneHref={admin ? "/admin/media" : "/dashboard/media"}
      />
    </main>
  );
}
