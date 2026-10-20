import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import SiteNavbar from "@/components/site-navbar";
import { authOptions } from "@/lib/auth";
import { isSchoolAccount } from "@/lib/school-account";

// every signed-in page keeps the same top bar / bottom tabs as the public site (the bar is fixed, so leave room for it)
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // a school's own login only has its school page (/school); the member pages are for people
  const session = await getServerSession(authOptions);
  if (session && (await isSchoolAccount(session.user.id))) redirect("/school");
  return (
    <>
      <SiteNavbar />
      <div className="min-h-[70vh] pt-16">{children}</div>
    </>
  );
}
