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
    visitStats, visitDaily,
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
    db.registrationCode.findMany({ orderBy: { createdAt: "desc" }, include: { school: { select: { name: true } } } }),
    db.user.count({ where: { registrationCodeId: { not: null }, createdAt: { gte: since30 } } }),
    db.user.count({ where: { creatorStatus: "PENDING" } }),
    db.areaReviewer.findMany({ select: { areaId: true } }),
    db.media.groupBy({ by: ["areaId"], where: { status: "PENDING" }, _count: { _all: true } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, memberType: true, createdAt: true, memberSchool: { select: { name: true } }, registrationCode: { select: { label: true } } } }),
    getVisitStats(now), dailyVisitors(14, now),
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

  // ---- sign-up codes
  const valid = codes.filter((c) => codeStatus(c, now) === "ok");
  const expiring = valid.filter((c) => c.expiresAt && c.expiresAt.getTime() - now.getTime() < 7 * DAY);
  const codeUses = codes.reduce((n, c) => n + c.usedCount, 0);

  // ---- things that need someone
  const alerts: Alert[] = [];
  const pending = status("PENDING");
  if (pending > 0) alerts.push({ level: "warn", text: `มีสื่อรออนุมัติ ${pending} ชิ้น${pendingOldestDays > 0 ? ` (ชิ้นที่รอนานสุด ${pendingOldestDays} วัน)` : ""}`, href: "/admin/media?status=PENDING", action: "ตรวจสื่อ" });
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
    schools: { total: schoolTotal, active: schoolActive, activated: schoolActivated, notActivated, withAccount, noCard: schoolNoCard, noLink: schoolNoLink, byDistrict: districtRows.map((d) => ({ district: d.district, count: d._count._all })) },
    codes: { total: codes.length, valid: valid.length, uses: codeUses, joined30: codeUsers30, list: valid.slice(0, 5), expiring: expiring.length },
    visits: { today: visitStats.today, month: visitStats.month, total: visitStats.total, since: visitStats.since, daily: visitDaily },
    alerts,
    todayBangkok: bangkokParts(now),
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
