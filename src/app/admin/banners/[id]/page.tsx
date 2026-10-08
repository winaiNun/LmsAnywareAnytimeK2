import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin, isManager } from "@/lib/permissions";
import { db } from "@/lib/db";
import { bannerImageUrl } from "@/lib/banners";
import { getLinkTargets } from "@/lib/link-targets";
import BannerForm from "../banner-form";

export default async function EditBannerPage({ params }: { params: { id: string } }) {
  const [b, linkGroups, session] = await Promise.all([db.banner.findUnique({ where: { id: params.id } }), getLinkTargets(), getServerSession(authOptions)]);
  if (!b) notFound();
  // teachers can only open their own slides
  if (!isManager(session?.user.role) && b.createdById !== session?.user.id) redirect("/admin/banners");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">แก้ไขแบนเนอร์</h1>
      <BannerForm
        linkGroups={linkGroups}
        isAdmin={isAdmin(session?.user.role)}
        initial={{
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          linkUrl: b.linkUrl,
          sourceUrl: b.sourceUrl,
          newTab: b.newTab,
          buttonText: b.buttonText,
          bgColor: b.bgColor,
          active: b.active,
          showText: b.showText,
          startAt: b.startAt?.toISOString() ?? "",
          endAt: b.endAt?.toISOString() ?? "",
          imageUrl: bannerImageUrl(b.imageKey),
        }}
      />
    </div>
  );
}
