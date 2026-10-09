import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { pinAllowed } from "@/lib/pin";
import { formatThaiDate } from "@/lib/thai-date";
import Link from "next/link";
import SignOutButton from "./sign-out-button";
import { CreatorRequestForm, PinForm, ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/dashboard");
  // a school account goes straight to its own page
  if (await db.school.findUnique({ where: { accountId: session.user.id }, select: { id: true } })) redirect("/school");

  const [user, schools, devices] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id } }),
    db.school.findMany({ where: { active: true }, select: { id: true, name: true, district: true, center: true }, orderBy: { name: "asc" } }),
    db.trustedDevice.findMany({ where: { userId: session.user.id }, orderBy: { lastUsedAt: "desc" } }),
  ]);
  if (!user) redirect("/login");
  const isStaff = user.role !== "STUDENT";

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">บัญชีของฉัน</h1>
      <p>
        สวัสดี {user.name} <span className="text-sm text-neutral-500">({MEMBER_TYPE_LABEL[user.memberType]} · {user.email ?? user.username})</span>
      </p>
      <div className="flex flex-wrap gap-3">
        {["ADMIN", "LIBRARIAN"].includes(user.role) && (
          <Link href="/admin" className="flex min-h-10 items-center rounded bg-brand px-4 font-semibold text-white">ไปหลังบ้าน</Link>
        )}
        {user.role === "TEACHER" && <Link href="/admin/banners" className="flex min-h-10 items-center rounded bg-brand px-4 font-semibold text-white">ไปหลังบ้านผู้สร้าง</Link>}
        <Link href="/account/password" className="flex min-h-10 items-center rounded border px-4">เปลี่ยนรหัสผ่าน</Link>
        <Link href="/" className="flex min-h-10 items-center rounded border px-4">หน้าแรก</Link>
        <SignOutButton />
      </div>

      {!isStaff && (
        <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">ผู้สร้างคอร์สเรียน</h2>
          {user.creatorStatus === "PENDING" ? (
            <p className="text-sm text-amber-700">ส่งคำขอสมัครเป็นผู้สร้างคอร์สแล้ว รอผู้ดูแลพิจารณา</p>
          ) : (
            <>
              {user.creatorStatus === "REJECTED" && <p className="text-sm text-red-600">คำขอก่อนหน้าไม่ได้รับอนุมัติ สามารถส่งคำขอใหม่ได้</p>}
              <CreatorRequestForm />
            </>
          )}
        </section>
      )}

      {pinAllowed(user.role) && <PinForm devices={devices.map((d) => ({ id: d.id, label: d.label, lastUsed: formatThaiDate(d.lastUsedAt) }))} />}

      <ProfileForm
        schools={schools}
        values={{
          memberType: user.memberType,
          prefix: user.prefix ?? "",
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          phone: user.phone ?? "",
          schoolId: user.schoolId ?? "",
          organization: user.organization ?? "",
          position: user.position ?? "",
          gradeLevel: user.gradeLevel ?? "",
        }}
      />
    </main>
  );
}
