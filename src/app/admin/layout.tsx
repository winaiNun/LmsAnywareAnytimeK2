import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import AdminShell from "@/components/admin/admin-shell";
import { authOptions } from "@/lib/auth";
import { canAuthor } from "@/lib/permissions";
import { db } from "@/lib/db";
import { avatarOf, getSiteInfo } from "@/lib/site";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/admin");
  if (!canAuthor(session.user.role)) redirect("/dashboard");

  const [site, me] = await Promise.all([
    getSiteInfo(),
    db.user.findUnique({ where: { id: session.user.id }, select: { avatarKey: true, avatarDriveId: true, avatarCx: true, avatarCy: true, avatarZoom: true, avatarAspect: true } }),
  ]);

  return (
    <AdminShell
      site={{ systemName: site.systemName, logoUrl: site.logoUrl }}
      user={{ name: session.user.name ?? "", role: session.user.role, avatar: me ? avatarOf(me) : null }}
    >
      {children}
    </AdminShell>
  );
}
