import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import AdminShell from "@/components/admin/admin-shell";
import { authOptions } from "@/lib/auth";
import { canAuthor } from "@/lib/permissions";
import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { avatarOf, getSiteInfo } from "@/lib/site";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/admin");
  if (!canAuthor(session.user.role)) redirect("/dashboard");

  const [site, me, reviewerCount] = await Promise.all([
    getSiteInfo(),
    db.user.findUnique({ where: { id: session.user.id }, select: { avatarKey: true, avatarDriveId: true, avatarCx: true, avatarCy: true, avatarZoom: true, avatarAspect: true, memberType: true } }),
    db.areaReviewer.count({ where: { userId: session.user.id } }),
  ]);

  return (
    <AdminShell
      site={{ systemName: site.systemName, logoUrl: site.logoUrl }}
      user={{ name: session.user.name ?? "", role: session.user.role, typeLabel: me ? MEMBER_TYPE_LABEL[me.memberType] : "", canReview: reviewerCount > 0 || session.user.role === "ADMIN", avatar: me ? avatarOf(me) : null }}
    >
      {children}
    </AdminShell>
  );
}
