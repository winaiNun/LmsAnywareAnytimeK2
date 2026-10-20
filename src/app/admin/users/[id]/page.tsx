import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/avatar";
import { db } from "@/lib/db";
import { avatarOf } from "@/lib/site";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import UserForm from "../user-form";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const [u, schools] = await Promise.all([
    db.user.findUnique({ where: { id: params.id } }),
    db.school.findMany({ select: { id: true, name: true, district: true, center: true }, orderBy: { name: "asc" } }),
  ]);
  if (!u) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="text-sm text-brand">← สมาชิกทั้งหมด</Link>
      <div className="flex items-center gap-4">
        <Avatar avatar={avatarOf(u)} name={u.name} size={64} />
        <h1 className="text-2xl font-bold">{u.name}</h1>
      </div>
      <UserForm
        schools={schools}
        user={{
          id: u.id,
          email: u.email ?? "",
          username: u.username ?? "",
          role: u.role,
          active: u.active,
          isSelf: u.id === me.id,
          creatorStatus: u.creatorStatus,
          creatorReason: u.creatorReason ?? "",
          selfPublish: u.selfPublish,
          profile: {
            memberType: u.memberType,
            prefix: u.prefix ?? "",
            firstName: u.firstName ?? u.name,
            lastName: u.lastName ?? "",
            phone: u.phone ?? "",
            schoolId: u.schoolId ?? "",
            organization: u.organization ?? "",
            position: u.position ?? "",
            gradeLevel: u.gradeLevel ?? "",
          },
        }}
      />
    </div>
  );
}
