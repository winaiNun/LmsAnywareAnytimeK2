/**
 * Everything the admin dashboard shows, from real tables only (no sample numbers). One function, so the page stays
 * markup and the numbers can be checked against the database in a test.
 */
import { db } from "@/lib/db";
import { MEMBER_TYPES, MEMBER_TYPE_LABEL, type MemberTypeKey } from "@/lib/members";
import { bangkokDay, topViewedIds } from "@/lib/media-counters";
import { codeStatus } from "@/lib/registration";
import { dailyVisitors, getVisitStats } from "@/lib/site-stats";
import { bangkokParts, lastMonthsBangkok } from "@/lib/thai-date";

export type Alert = { level: "danger" | "warn" | "info"; text: string; href: string; action: string };

const DAY = 86400000;

export async function getDashboard(now: Date = new Date()) {
  const since30 = new Date(now.getTime() - 30 * DAY);
  const months = lastMonthsBangkok(6, now);
  const today = bangkokDay(now);
  const from14 = new Date(today.getTime() - 13 * DAY);
  const from30 = new Date(today.getTime() - 29 * DAY);

  const [
    site, memberTotal, memberNew30, memberTypes, monthlyRows,
    mediaStatus, mediaTotals, views30, daily, areas, pendingList, topIds,
    schoolTotal, schoolActive, schoolActivated, schoolNoCard, schoolNoLink, districtRows,
    codes, codeUsers30, creatorPending, reviewerAreas, pendingByArea, recent,
    visitStats, visitDaily, courseStatus, enrollTotal, completeTotal, faqOpen,
  ] = await Promise.all([
    db.siteSetting.findUnique({ where: { id: "main" }, select: { requireRegistrationCode: true, allowServerUploads: true } }),
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: since30 } } }),
    db.user.groupBy({ by: ["memberType"], _count: { _all: true } }),
    db.$queryRaw<{ m: string; n: bigint }[]>`SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'Asia/Bangkok'), 'YYYY-MM') AS m, count(*) AS n FROM "User" WHERE "createdAt" >= ${months[0].start} GROUP BY 1`,
    db.media.groupBy({ by: ["status"], _count: { _all: true } }),
    db.media.aggregate({ where: { status: "PUBLISHED" }, _sum: { viewCount: true, likeCount: true, downloadCount: true } }),
    db.mediaViewDaily.aggregate({ where: { day: { gte: from30 }, media: { status: "PUBLISHED" } }, _sum: { views: true } }),
    db.mediaViewDaily.groupBy({ by: ["day"], where: { day: { gte: from14 }, media: { status: "PUBLISHED" } }, _sum: { views: true } }),
    db.learningArea.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, color: true, _count: { select: { media: { where: { status: "PUBLISHED" } } } } } }),
    db.media.findMany({ where: { status: "PENDING" }, orderBy: { updatedAt: "asc" }, take: 5, select: { id: true, title: true, updatedAt: true, area: { select: { name: true } }, createdBy: { select: { name: true } } } }),
    topViewedIds(5),
    db.school.count(),
    db.school.count({ where: { active: true } }),
    db.school.count({ where: { account: { is: { mustChangePassword: false } } } }),
    db.school.count({ where: { cardKey: null, cardSourceUrl: null } }),
    db.school.count({ where: { siteUrl: null } }),
    db.school.groupBy({ by: ["district"], _count: { _all: true }, orderBy: { _count: { district: "desc" } }, take: 8 }),
    db.registrationCode.findMany({ where: { parentId: null }, orderBy: { createdAt: "desc" }, include: { school: { select: { name: true } } } }), // group codes stand for their sub-codes
    db.user.count({ where: { registrationCodeId: { not: null }, createdAt: { gte: since30 } } }),
    db.user.count({ where: { creatorStatus: "PENDING" } }),
    db.areaReviewer.findMany({ select: { areaId: true } }),
    db.media.groupBy({ by: ["areaId"], where: { status: "PENDING" }, _count: { _all: true } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, memberType: true, createdAt: true, memberSchool: { select: { name: true } }, registrationCode: { select: { label: true } } } }),
    getVisitStats(now), dailyVisitors(14, now),
    db.course.groupBy({ by: ["status"], _count: { _all: true } }),
    db.enrollment.count({ where: { course: { status: "PUBLISHED" } } }),
    db.enrollment.count({ where: { completedAt: { not: null }, course: { status: "PUBLISHED" } } }),
    db.faqUnanswered.count({ where: { status: "OPEN" } }),
  ]);

  // ---- members
  const byType = MEMBER_TYPES.map((t) => ({ type: t as MemberTypeKey, label: MEMBER_TYPE_LABEL[t], value: memberTypes.find((r) => r.memberType === t)?._count._all ?? 0 }));
  const monthly = months.map((m) => {
    const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
    return { year: m.year, month: m.month, value: Number(monthlyRows.find((r) => r.m === key)?.n ?? 0) };
  });

  // ---- media
  const status = (s: string) => mediaStatus.find((r) => r.status === s)?._count._all ?? 0;
  const dailyViews = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(from14.getTime() + i * DAY);
    const row = daily.find((r) => r.day.getTime() === d.getTime());
    return { day: d.getUTCDate(), value: row?._sum.views ?? 0 };
  });
  const top = topIds.length
    ? (await db.media.findMany({ where: { id: { in: topIds } }, select: { id: true, title: true, viewCount: true, likeCount: true, area: { select: { name: true } } } })).sort((a, b) => topIds.indexOf(a.id) - topIds.indexOf(b.id))
    : [];
  const pendingOldestDays = pendingList[0] ? Math.max(0, Math.floor((now.getTime() - pendingList[0].updatedAt.getTime()) / DAY)) : 0;

  // ---- courses
  const courseCount = (st: string) => courseStatus.find((r) => r.status === st)?._count._all ?? 0;
  const coursesPending = courseCount("PENDING");

  // ---- sign-up codes
  const valid = codes.filter((c) => codeStatus(c, now) === "ok");
  const expiring = valid.filter((c) => c.expiresAt && c.expiresAt.getTime() - now.getTime() < 7 * DAY);
  const codeUses = codes.reduce((n, c) => n + c.groupUsed, 0);

  // ---- things that need someone
  const alerts: Alert[] = [];
  const pending = status("PENDING");
  if (pending > 0) alerts.push({ level: "warn", text: `มีสื่อรออนุมัติ ${pending} ชิ้น${pendingOldestDays > 0 ? ` (ชิ้นที่รอนานสุด ${pendingOldestDays} วัน)` : ""}`, href: "/admin/media?status=PENDING", action: "ตรวจสื่อ" });
  if (coursesPending > 0) alerts.push({ level: "warn", text: `มีคอร์สรออนุมัติ ${coursesPending} คอร์ส`, href: "/admin/courses?status=PENDING", action: "ตรวจคอร์ส" });
  if (faqOpen > 0) alerts.push({ level: "info", text: `มีคำถามในแชตถามตอบที่ยังตอบไม่ได้ ${faqOpen} ข้อ`, href: "/admin/faq?tab=unanswered", action: "เพิ่มคำตอบ" });
  if (creatorPending > 0) alerts.push({ level: "warn", text: `มีคำขอเป็นผู้สร้างคอร์ส ${creatorPending} รายการรอพิจารณา`, href: "/admin/users?creator=pending", action: "พิจารณา" });
  if ((site?.requireRegistrationCode ?? true) && valid.length === 0) alerts.push({ level: "danger", text: "ไม่มีรหัสสมัครที่ใช้งานได้ — ผู้สมัครใหม่จะสมัครไม่ได้", href: "/admin/registration-codes", action: "สร้างรหัส" });
  if (expiring.length > 0) alerts.push({ level: "info", text: `รหัสสมัคร ${expiring.length} รหัสจะหมดอายุภายใน 7 วัน`, href: "/admin/registration-codes", action: "ดูรหัส" });
  const reviewerSet = new Set(reviewerAreas.map((r) => r.areaId));
  const noReviewer = pendingByArea.filter((p) => !reviewerSet.has(p.areaId));
  if (noReviewer.length > 0) {
    const names = areas.filter((a) => noReviewer.some((p) => p.areaId === a.id)).map((a) => a.name);
    alerts.push({ level: "info", text: `กลุ่มสาระที่มีสื่อรออนุมัติแต่ยังไม่มีผู้ตรวจ (แอดมินต้องตรวจเอง): ${names.join(", ")}`, href: "/admin/media-taxonomy", action: "แต่งตั้งผู้ตรวจ" });
  }
  const notActivated = schoolTotal - schoolActivated;
  const withAccount = await db.school.count({ where: { accountId: { not: null } } });
  const waiting = withAccount - schoolActivated;
  if (waiting > 0) alerts.push({ level: "info", text: `${waiting} โรงเรียนยังไม่ได้เข้าสู่ระบบและเปลี่ยนรหัสผ่านชั่วคราว`, href: "/admin/schools?status=mustchange", action: "ดูรายชื่อ" });
  if (schoolNoCard > 0) alerts.push({ level: "info", text: `${schoolNoCard} โรงเรียนยังไม่มีภาพการ์ด`, href: "/admin/schools?status=nocard", action: "ดูรายชื่อ" });
  if (schoolNoLink > 0) alerts.push({ level: "info", text: `${schoolNoLink} โรงเรียนยังไม่มีลิงก์เว็บไซต์ Anywhere Anytime`, href: "/admin/schools?status=nolink", action: "ดูรายชื่อ" });

  return {
    flags: { requireCode: site?.requireRegistrationCode ?? true, uploads: site?.allowServerUploads ?? false },
    members: { total: memberTotal, new30: memberNew30, byType, monthly, recent },
    media: {
      published: status("PUBLISHED"), pending, draft: status("DRAFT"), rejected: status("REJECTED"),
      views: mediaTotals._sum.viewCount ?? 0, likes: mediaTotals._sum.likeCount ?? 0, downloads: mediaTotals._sum.downloadCount ?? 0,
      views30: views30._sum.views ?? 0, dailyViews, areas: areas.map((a) => ({ id: a.id, name: a.name, color: a.color, count: a._count.media })), pendingList, top,
    },
    courses: { published: courseCount("PUBLISHED"), pending: coursesPending, draft: courseCount("DRAFT"), rejected: courseCount("REJECTED"), learners: enrollTotal, completed: completeTotal },
    schools: { total: schoolTotal, active: schoolActive, activated: schoolActivated, notActivated, withAccount, noCard: schoolNoCard, noLink: schoolNoLink, byDistrict: districtRows.map((d) => ({ district: d.district, count: d._count._all })) },
    codes: { total: codes.length, valid: valid.length, uses: codeUses, joined30: codeUsers30, list: valid.slice(0, 5), expiring: expiring.length },
    visits: { today: visitStats.today, month: visitStats.month, total: visitStats.total, since: visitStats.since, daily: visitDaily },
    alerts,
    todayBangkok: bangkokParts(now),
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

// ---------------------------------------------------------------------------------------------- extras for the dashboard
export type Check = { ok: boolean; level: "danger" | "warn" | "info"; text: string; href: string; action: string };

/** Numbers shown as little badges in the side menu (what is waiting for a decision). */
export async function getAdminBadges(): Promise<Record<string, number>> {
  const [media, courses, creators, faq] = await Promise.all([
    db.media.count({ where: { status: "PENDING" } }),
    db.course.count({ where: { status: "PENDING" } }),
    db.user.count({ where: { creatorStatus: "PENDING" } }),
    db.faqUnanswered.count({ where: { status: "OPEN" } }),
  ]);
  return { "/admin/media": media, "/admin/courses": courses, "/admin/users": creators, "/admin/faq": faq };
}

const DEFAULT_ADMIN_PASSWORD = "ChangeMe123!";

/**
 * "Ready to go live?" checks: things that are easy to forget and that matter once real people use the system.
 * Each one says what is wrong and where to fix it; the dashboard shows only the ones that are not fine yet.
 */
export async function getReadiness(): Promise<Check[]> {
  const [admins, pages, faqShown, site, validCodes] = await Promise.all([
    db.user.findMany({ where: { role: "ADMIN", active: true }, select: { name: true, passwordHash: true } }),
    db.sitePage.findMany({ where: { slug: { in: ["privacy", "terms"] } }, select: { slug: true } }),
    db.faqItem.count({ where: { active: true } }),
    db.siteSetting.findUnique({ where: { id: "main" }, select: { allowServerUploads: true, requireRegistrationCode: true } }),
    db.registrationCode.count({ where: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
  ]);
  const { compare } = await import("bcryptjs");
  const defaults: string[] = [];
  for (const a of admins) if (await compare(DEFAULT_ADMIN_PASSWORD, a.passwordHash)) defaults.push(a.name);
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  const durable = process.env.STORAGE_DRIVER === "s3" || !process.env.VERCEL;
  const has = (slug: string) => pages.some((p) => p.slug === slug);
  return [
    { ok: defaults.length === 0, level: "danger", text: `บัญชีแอดมินยังใช้รหัสผ่านเริ่มต้น (${defaults.join(", ")})`, href: "/admin/users", action: "ตั้งรหัสใหม่" },
    { ok: secret.length >= 32 && !/change|secret|example/i.test(secret), level: "danger", text: "NEXTAUTH_SECRET สั้นเกินไปหรือยังเป็นค่าตัวอย่าง (ตั้งค่าที่ตัวแปรสภาพแวดล้อมของเซิร์ฟเวอร์)", href: "/admin/settings", action: "ดูตั้งค่า" },
    { ok: has("privacy") && has("terms"), level: "warn", text: "นโยบายความเป็นส่วนตัวและเงื่อนไขการใช้งานยังเป็นฉบับร่างเริ่มต้น — ให้ผู้รับผิดชอบตรวจและบันทึกฉบับจริง", href: "/admin/pages", action: "แก้ไขหน้า" },
    { ok: !(site?.requireRegistrationCode ?? true) || validCodes > 0, level: "danger", text: "เปิดโหมดสมัครด้วยรหัส แต่ยังไม่มีรหัสที่ใช้งานได้", href: "/admin/registration-codes", action: "สร้างรหัส" },
    { ok: !(site?.allowServerUploads ?? false) || durable, level: "warn", text: "เปิดให้อัปโหลดรูปเข้าเซิร์ฟเวอร์ แต่ที่เก็บไฟล์ยังไม่ถาวร (ไฟล์อาจหาย) — ตั้งค่า R2/S3 หรือปิดสวิตช์", href: "/admin/settings", action: "ดูตั้งค่า" },
    { ok: faqShown > 0, level: "info", text: "แชตถามตอบยังไม่แสดงเพราะยังไม่มีคำถามที่เปิดแสดง", href: "/admin/faq", action: "จัดการ FAQ" },
    { ok: !process.env.VERCEL || !!process.env.TURNSTILE_SECRET_KEY, level: "info", text: "ยังไม่ได้เปิดตัวตรวจบอตหน้าสมัครสมาชิก (Cloudflare Turnstile)", href: "/admin/settings", action: "ดูตั้งค่า" },
  ];
}

/** Who actually takes part, school by school: the point of the whole project is that people use it. */
export async function getEngagement() {
  const adults = { active: true, memberType: { not: "STUDENT" as const } };
  const [schools, withMembers, adultTotal, consenting, hidden] = await Promise.all([
    db.school.findMany({ where: { active: true }, select: { id: true, district: true } }),
    db.user.findMany({ where: { ...adults, schoolId: { not: null } }, distinct: ["schoolId"], select: { schoolId: true } }),
    db.user.count({ where: adults }),
    db.user.count({ where: { ...adults, showInHonors: true, honorsHidden: false } }),
    db.user.count({ where: { ...adults, honorsHidden: true } }),
  ]);
  const covered = new Set(withMembers.map((u) => u.schoolId));
  const byDistrict = new Map<string, { total: number; covered: number }>();
  for (const s of schools) {
    const d = byDistrict.get(s.district) ?? { total: 0, covered: 0 };
    d.total++;
    if (covered.has(s.id)) d.covered++;
    byDistrict.set(s.district, d);
  }
  return {
    schools: { total: schools.length, covered: schools.filter((s) => covered.has(s.id)).length },
    districts: [...byDistrict.entries()].map(([district, v]) => ({ district, ...v })).sort((a, b) => b.total - a.total),
    honors: { adults: adultTotal, consenting, hidden },
  };
}

/** Courses made for certain member types: how many of that group exist, joined and finished (the director's "are the principals learning?"). */
export async function getAudienceCourses() {
  const courses = await db.course.findMany({
    where: { status: "PUBLISHED", NOT: { audienceTypes: { isEmpty: true } } },
    orderBy: { publishedAt: "desc" },
    take: 8,
    select: { id: true, title: true, audienceTypes: true, audienceOnly: true, mandatory: true, dueAt: true, _count: { select: { enrollments: true } } },
  });
  return Promise.all(
    courses.map(async (c) => {
      const [population, completed] = await Promise.all([
        db.user.count({ where: { active: true, memberType: { in: c.audienceTypes } } }),
        db.enrollment.count({ where: { courseId: c.id, completedAt: { not: null }, user: { memberType: { in: c.audienceTypes } } } }),
      ]);
      const joined = await db.enrollment.count({ where: { courseId: c.id, user: { memberType: { in: c.audienceTypes } } } });
      return { id: c.id, title: c.title, audience: c.audienceTypes as string[], only: c.audienceOnly, mandatory: c.mandatory, dueAt: c.dueAt, population, joined, completed, others: c._count.enrollments - joined };
    }),
  );
}
