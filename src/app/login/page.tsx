import { getSiteInfo } from "@/lib/site";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

// Only same-site paths: prevents using the login page as an open redirect.
function safePath(v: string | string[] | undefined) {
  const p = Array.isArray(v) ? v[0] : v;
  return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
}

export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string; changed?: string } }) {
  const site = await getSiteInfo();
  return <LoginForm systemName={site.systemName} areaName={site.areaName} logoUrl={site.logoUrl} logoBackdrop={site.logoBackdrop} callbackUrl={safePath(searchParams.callbackUrl)} devShortcut={process.env.NODE_ENV === "development"} notice={searchParams.changed ? "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่" : null} />;
}
