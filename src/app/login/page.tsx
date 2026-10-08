import { getSiteInfo } from "@/lib/site";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

// Only same-site paths: prevents using the login page as an open redirect.
function safePath(v: string | string[] | undefined) {
  const p = Array.isArray(v) ? v[0] : v;
  return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
}

export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string } }) {
  const site = await getSiteInfo();
  return <LoginForm systemName={site.systemName} areaName={site.areaName} logoUrl={site.logoUrl} callbackUrl={safePath(searchParams.callbackUrl)} />;
}
