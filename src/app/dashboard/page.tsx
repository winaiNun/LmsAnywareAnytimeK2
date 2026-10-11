import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { pinAllowed } from "@/lib/pin";
import { formatThaiDate } from "@/lib/thai-date";
import Link from "next/link";
import Avatar from "@/components/avatar";
import { Icon, type IconName } from "@/components/icons";
import AvatarEditor from "@/components/avatar-editor";
import { avatarOf, getSiteInfo } from "@/lib/site";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";
import SignOutButton from "./sign-out-button";
import { CreatorRequestForm, PinForm, ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/dashboard");
  // a school account goes straight to its own page
  if (await db.school.findUnique({ where: { accountId: session.user.id }, select: { id: true } })) redirect("/school");

  const [user, schools, devices, site, reviewerCount, texts] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id } }),
    db.school.findMany({ where: { active: true }, select: { id: true, name: true, district: true, center: true }, orderBy: { name: "asc" } }),
    db.trustedDevice.findMany({ where: { userId: session.user.id }, orderBy: { lastUsedAt: "desc" } }),
    getSiteInfo(),
    db.areaReviewer.count({ where: { userId: session.user.id } }),
    getSiteTexts(),
  ]);
  const isReviewer = reviewerCount > 0;
  if (!user) redirect("/login");
  const isStaff = user.role !== "STUDENT";

  const links: { href: string; label: string; icon: IconName; primary?: boolean }[] = [
    ...(["ADMIN", "LIBRARIAN"].includes(user.role) ? [{ href: "/admin", label: plainText(texts["account.admin"]), icon: "shield" as const, primary: true }] : []),
    ...(user.role === "TEACHER" ? [{ href: "/admin/banners", label: plainText(texts["account.creator"]), icon: "shield" as const, primary: true }] : []),
    { href: "/dashboard/media", label: "สื่อของฉัน", icon: "library" },
    { href: "/dashboard/learning", label: "คอร์สที่ฉันเรียน", icon: "course" },
    { href: "/dashboard/certificates", label: plainText(texts["account.certs"]), icon: "award" },
    ...((["ADMIN", "TEACHER"].includes(user.role) || user.creatorStatus === "APPROVED") ? [{ href: "/dashboard/courses", label: "คอร์สของฉัน (ผู้สอน)", icon: "presentation" as const }] : []),
    ...((isReviewer || user.role === "ADMIN") ? [{ href: "/dashboard/review", label: "ตรวจสื่อ", icon: "clipboardCheck" as const }] : []),
    { href: "/account/password", label: "เปลี่ยนรหัสผ่าน", icon: "lock" },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <section className="flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-6 text-center text-white shadow-sm sm:flex-row sm:text-left">
        <Avatar avatar={avatarOf(user)} name={user.name} size={88} className="ring-4 ring-white/40" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/80">สวัสดี</p>
          <h1 className="break-words text-2xl font-bold">{user.name}</h1>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/85 sm:justify-start">
            <span className="rounded-full bg-white/20 px-3 py-0.5 font-medium">{MEMBER_TYPE_LABEL[user.memberType]}</span>
            <span className="break-all">{user.email ?? user.username}</span>
          </p>
        </div>
        <SignOutButton />
      </section>

      <nav aria-label="ทางลัดบัญชี" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 shadow-sm transition-colors ${l.primary ? "border-brand bg-brand-soft text-brand hover:bg-brand/10" : "border-neutral-200 bg-white hover:border-brand hover:bg-brand-soft"}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${l.primary ? "bg-brand text-white" : "bg-neutral-100 text-neutral-600"}`}><Icon name={l.icon} className="h-5 w-5" /></span>
            <span className="text-sm font-semibold leading-snug">{l.label}</span>
          </Link>
        ))}
      </nav>

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

      <AvatarEditor avatar={avatarOf(user)} name={user.name} allowUpload={site.allowServerUploads} />

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
