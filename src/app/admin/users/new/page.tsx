import Link from "next/link";
import { db } from "@/lib/db";
import { emptyProfile } from "@/components/profile-fields";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import UserForm from "../user-form";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const schools = await db.school.findMany({ select: { id: true, name: true, district: true, center: true }, orderBy: { name: "asc" } });
  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="text-sm text-brand">← สมาชิกทั้งหมด</Link>
      <h1 className="text-2xl font-bold">เพิ่มผู้ใช้</h1>
      <UserForm schools={schools} user={{ email: "", username: "", role: "STUDENT", active: true, isSelf: false, creatorStatus: "NONE", creatorReason: "", selfPublish: false, profile: emptyProfile }} />
    </div>
  );
}
