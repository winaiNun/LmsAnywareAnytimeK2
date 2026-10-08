import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteInfo } from "@/lib/site";
import NavbarClient from "./navbar-client";

const STAFF = ["ADMIN", "LIBRARIAN"];

export default async function SiteNavbar() {
  const [session, site] = await Promise.all([getServerSession(authOptions), getSiteInfo()]);
  const user = session?.user
    ? { name: session.user.name ?? "", isStaff: STAFF.includes(session.user.role) }
    : null;

  return <NavbarClient user={user} name={site.systemName} logoUrl={site.logoUrl} />;
}
