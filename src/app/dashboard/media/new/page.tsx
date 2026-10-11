import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormOptions } from "@/lib/media-data";
import { getActor } from "@/lib/media-server";
import { storageIsDurable } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";
import MediaForm from "../media-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "เพิ่มสื่อ" };

export default async function NewMediaPage() {
  const actor = await getActor();
  if (!actor) redirect("/login?callbackUrl=/dashboard/media/new");
  const [{ areas, types, levels }, site] = await Promise.all([getFormOptions(), getSiteInfo()]);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <Link href="/dashboard/media" className="text-sm text-brand">← สื่อของฉัน</Link>
        <h1 className="text-2xl font-bold">เพิ่มสื่อ</h1>
      </div>
      <MediaForm
        values={{ title: "", description: "", areaId: "", typeId: "", levelIds: [], tags: "", authorName: "", coverUrl: null, coverDrive: "", coverFx: 0.5, coverFy: 0.5, items: [] }}
        areas={areas} types={types} levels={levels}
        allowUpload={site.allowServerUploads && storageIsDurable()}
        isAdmin={actor.role === "ADMIN"}
        isStudent={actor.memberType === "STUDENT" && actor.role !== "ADMIN"}
        doneHref={actor.role === "ADMIN" ? "/admin/media" : "/dashboard/media"}
      />
    </main>
  );
}
