import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import AdminShell from "@/components/admin/admin-shell";
import { authOptions } from "@/lib/auth";
import { canAuthor } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getAdminBadges } from "@/lib/admin-stats";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { avatarOf, getSiteInfo } from "@/lib/site";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/admin");
  if (!canAuthor(session.user.role)) redirect("/dashboard");

  const manager = session.user.role === "ADMIN" || session.user.role === "LIBRARIAN";
  const [site, me, reviewerCount, badges] = await Promise.all([
    getSiteInfo(),
    db.user.findUnique({ where: { id: session.user.id }, select: { name: true, avatarKey: true, avatarDriveId: true, avatarCx: true, avatarCy: true, avatarZoom: true, avatarAspect: true, memberType: true } }),
    db.areaReviewer.count({ where: { userId: session.user.id } }),
    manager ? getAdminBadges() : Promise.resolve({} as Record<string, number>),
  ]);

  return (
    <AdminShell
      badges={badges}
      site={{ systemName: site.systemName, logoUrl: site.logoUrl }}
      user={{ name: me?.name ?? session.user.name ?? "", role: session.user.role, typeLabel: me ? MEMBER_TYPE_LABEL[me.memberType] : "", canReview: reviewerCount > 0 || session.user.role === "ADMIN", avatar: me ? avatarOf(me) : null }}
    >
      {children}
    </AdminShell>
  );
}
