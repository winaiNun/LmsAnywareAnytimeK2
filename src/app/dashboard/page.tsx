import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { pinAllowed } from "@/lib/pin";
import { formatThaiDate } from "@/lib/thai-date";
import Link from "next/link";
import Avatar from "@/components/avatar";
import CourseCard from "@/components/course-card";
import { getTodoCourses } from "@/lib/course/todo";
import { courseCardSelect, toCourseCard } from "@/lib/course/course-data";
import { Icon, type IconName } from "@/components/icons";
import AvatarEditor from "@/components/avatar-editor";
import { avatarOf, getSiteInfo } from "@/lib/site";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";
import SignOutButton from "./sign-out-button";
import { BIO_MAX } from "@/lib/honors-rank";
import { getHonorsSettings } from "@/lib/honors";
import { CreatorRequestForm, HonorsForm, PinForm, ProfileForm } from "./profile-form";

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
  const honors = await getHonorsSettings();
  if (!user) redirect("/login");
  // "courses I have to take": must-take courses for my type and any joined course with a finish-by date; finished ones drop out
  const todo = await getTodoCourses(user.id, user.memberType);
  const todoIds = new Set(todo.map((c) => c.id));
  // courses made for this member type that they have not joined yet
  const forYou = (
    await db.course.findMany({
      where: { status: "PUBLISHED", enrollOpen: true, audienceTypes: { has: user.memberType }, enrollments: { none: { userId: user.id } } },
      orderBy: [{ publishedAt: "desc" }],
      take: 3,
      select: courseCardSelect,
    })
  ).filter((c) => !todoIds.has(c.id)).map(toCourseCard);
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

      {todo.length > 0 && (
        <section id="todo" aria-label="คอร์สที่ต้องเรียน" className="scroll-mt-20 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
          <h2 className="font-semibold">คอร์สที่ต้องเรียน <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{todo.length}</span></h2>
          <ul className="divide-y divide-amber-100">
            {todo.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link href={`/courses/${c.id}`} className="font-medium hover:text-brand">{c.title}</Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {c.must && <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">บังคับ</span>}
                    {c.due.text && <span className={`rounded-full px-2 py-0.5 font-medium ${c.due.tone}`}>{c.due.text}</span>}
                    <span className="text-neutral-500">{c.enrolled ? "กำลังเรียน" : "ยังไม่ได้ลงทะเบียน"}</span>
                  </p>
                </div>
                <Link href={`/courses/${c.id}`} className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">{c.enrolled ? "เรียนต่อ" : "ลงทะเบียน"}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {forYou.length > 0 && (
        <section aria-label="คอร์สแนะนำสำหรับคุณ" className="space-y-3">
          <h2 className="font-semibold">คอร์สแนะนำสำหรับคุณ ({MEMBER_TYPE_LABEL[user.memberType]})</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{forYou.map((c) => <li key={c.id}><CourseCard course={c} /></li>)}</ul>
        </section>
      )}

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

      {honors.enabled && user.memberType !== "STUDENT" && (
        <HonorsForm prefs={{ show: user.showInHonors, photo: user.honorsShowPhoto, school: user.honorsShowSchool, bio: user.honorsBio ?? "", hidden: user.honorsHidden }} bioMax={BIO_MAX} />
      )}

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
