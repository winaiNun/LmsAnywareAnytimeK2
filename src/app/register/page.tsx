import { db } from "@/lib/db";
import { getSiteInfo } from "@/lib/site";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "สมัครสมาชิก" };

export default async function RegisterPage() {
  const [site, schools] = await Promise.all([
    getSiteInfo(),
    db.school.findMany({ where: { active: true }, select: { id: true, name: true, district: true }, orderBy: { name: "asc" } }),
  ]);
  return <RegisterForm systemName={site.systemName} schools={schools} />;
}
