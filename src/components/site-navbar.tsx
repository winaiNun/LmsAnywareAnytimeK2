import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { avatarOf, getSiteInfo } from "@/lib/site";
import NavbarClient from "./navbar-client";

const STAFF = ["ADMIN", "LIBRARIAN", "TEACHER"]; // may open the back office

export default async function SiteNavbar() {
  const [session, site] = await Promise.all([getServerSession(authOptions), getSiteInfo()]);
  const me = session?.user
    ? await db.user.findUnique({ where: { id: session.user.id }, select: { avatarKey: true, avatarDriveId: true, avatarCx: true, avatarCy: true, avatarZoom: true, avatarAspect: true } })
    : null;
  const user = session?.user
    ? { name: session.user.name ?? "", isStaff: STAFF.includes(session.user.role), avatar: me ? avatarOf(me) : null }
    : null;

  return <NavbarClient user={user} name={site.systemName} logoUrl={site.logoUrl} />;
}
