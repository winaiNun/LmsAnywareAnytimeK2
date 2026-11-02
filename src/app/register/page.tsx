import { db } from "@/lib/db";
import { getSiteInfo } from "@/lib/site";
import { getSiteTexts } from "@/lib/site-texts-server";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "สมัครสมาชิก" };

export default async function RegisterPage() {
  const [site, texts, schools] = await Promise.all([
    getSiteInfo(),
    getSiteTexts(),
    db.school.findMany({ where: { active: true }, select: { id: true, name: true, district: true, center: true }, orderBy: { name: "asc" } }),
  ]);
  // training mode (admin approves each account) replaces the code step
  const approval = site.registrationApproval;
  const approvalTexts = approval ? { note: texts["register.approvalNote"], pendingTitle: texts["register.pending.title"], pendingSubtitle: texts["register.pending.subtitle"] } : null;
  return <RegisterForm requireCode={site.requireRegistrationCode && !approval} approval={approvalTexts} systemName={site.systemName} areaName={site.areaName} logoUrl={site.logoUrl} schools={schools} />;
}
