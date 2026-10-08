import { getSiteInfo } from "@/lib/site";
import SettingsForm from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const site = await getSiteInfo();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ตั้งค่าเขตพื้นที่และหน้าแรก</h1>
      <SettingsForm initial={site} />
    </div>
  );
}
