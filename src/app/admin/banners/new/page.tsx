import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLinkTargets } from "@/lib/link-targets";
import { isAdmin } from "@/lib/permissions";
import BannerForm from "../banner-form";

export const dynamic = "force-dynamic";

export default async function NewBannerPage() {
  const [linkGroups, session] = await Promise.all([getLinkTargets(), getServerSession(authOptions)]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">เพิ่มแบนเนอร์</h1>
      <BannerForm linkGroups={linkGroups} isAdmin={isAdmin(session?.user.role)} />
    </div>
  );
}
