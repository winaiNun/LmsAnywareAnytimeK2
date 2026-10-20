import { getSiteInfo } from "@/lib/site";
import { requireManagerPage } from "@/lib/permissions";
import SettingsForm from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireManagerPage();
  const site = await getSiteInfo();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ตั้งค่าเขตพื้นที่และหน้าแรก</h1>
      <SettingsForm initial={{ ...site, systemName: site.systemNameRaw, areaName: site.areaNameRaw, tagline: site.taglineRaw }} />
    </div>
  );
}
