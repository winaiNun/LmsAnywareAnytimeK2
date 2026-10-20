import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canCreateCourse } from "@/lib/course/access";
import { getTodoCourses, todoBadge } from "@/lib/course/todo";
import { isSchoolAccount } from "@/lib/school-account";
import { areaCounts } from "@/lib/media-list";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { avatarOf, getSiteInfo } from "@/lib/site";
import { getSiteTexts } from "@/lib/site-texts-server";
import NavbarClient from "./navbar-client";

const STAFF = ["ADMIN", "LIBRARIAN", "TEACHER"]; // may open the back office

export default async function SiteNavbar() {
  const [session, site, texts] = await Promise.all([getServerSession(authOptions), getSiteInfo(), getSiteTexts()]);
  const [me, reviewerCount, areas] = await Promise.all([
    session?.user
      ? db.user.findUnique({ where: { id: session.user.id }, select: { name: true, creatorStatus: true, memberType: true, avatarKey: true, avatarDriveId: true, avatarCx: true, avatarCy: true, avatarZoom: true, avatarAspect: true } })
      : null,
    session?.user ? db.areaReviewer.count({ where: { userId: session.user.id } }) : 0,
    areaCounts(),
  ]);
  // "courses I have to take": a small badge on the account button (nothing is sent anywhere; it only shows while the person is on the site)
  let todo = { count: 0, urgent: false };
  if (session?.user && me) {
    todo = todoBadge(await getTodoCourses(session.user.id, me.memberType));
    if (todo.count > 0 && (await isSchoolAccount(session.user.id))) todo = { count: 0, urgent: false }; // a school's login is not a person
  }
  const user = session?.user
    ? { name: me?.name ?? session.user.name ?? "", isStaff: STAFF.includes(session.user.role), canReview: reviewerCount > 0 || session.user.role === "ADMIN", canTeach: canCreateCourse({ role: session.user.role, creatorStatus: me?.creatorStatus }), typeLabel: me ? MEMBER_TYPE_LABEL[me.memberType] : "", avatar: me ? avatarOf(me) : null, todo }
    : null;

  return <NavbarClient user={user} name={site.systemName} areaName={site.areaName} logoUrl={site.logoUrl} texts={texts} areas={areas.map((a) => ({ slug: a.slug, name: a.name, icon: a.icon, color: a.color }))} />;
}
