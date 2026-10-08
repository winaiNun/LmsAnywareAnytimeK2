import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import AdminShell from "@/components/admin/admin-shell";
import { authOptions } from "@/lib/auth";
import { canAuthor } from "@/lib/permissions";
import { getSiteInfo } from "@/lib/site";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/admin");
  if (!canAuthor(session.user.role)) redirect("/dashboard");

  const site = await getSiteInfo();

  return (
    <AdminShell
      site={{ systemName: site.systemName, logoUrl: site.logoUrl }}
      user={{ name: session.user.name ?? "", role: session.user.role }}
    >
      {children}
    </AdminShell>
  );
}
