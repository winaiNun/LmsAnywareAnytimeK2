import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { areaCounts } from "@/lib/media-list";
import { avatarOf, getSiteInfo } from "@/lib/site";
import NavbarClient from "./navbar-client";

const STAFF = ["ADMIN", "LIBRARIAN", "TEACHER"]; // may open the back office

export default async function SiteNavbar() {
  const [session, site] = await Promise.all([getServerSession(authOptions), getSiteInfo()]);
  const [me, reviewerCount, areas] = await Promise.all([
    session?.user
      ? db.user.findUnique({ where: { id: session.user.id }, select: { avatarKey: true, avatarDriveId: true, avatarCx: true, avatarCy: true, avatarZoom: true, avatarAspect: true } })
      : null,
    session?.user ? db.areaReviewer.count({ where: { userId: session.user.id } }) : 0,
    areaCounts(),
  ]);
  const user = session?.user
    ? { name: session.user.name ?? "", isStaff: STAFF.includes(session.user.role), canReview: reviewerCount > 0 || session.user.role === "ADMIN", avatar: me ? avatarOf(me) : null }
    : null;

  return <NavbarClient user={user} name={site.systemName} areaName={site.areaName} logoUrl={site.logoUrl} areas={areas.map((a) => ({ slug: a.slug, name: a.name, icon: a.icon, color: a.color }))} />;
}
