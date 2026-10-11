import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { isAdmin, isManager } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const LIMIT = 5;
const COURSE_STATUS: Record<string, string> = { DRAFT: "ร่าง", PENDING: "รออนุมัติ", PUBLISHED: "เผยแพร่แล้ว", REJECTED: "ส่งกลับ" };
const STATUS: Record<string, string> = { DRAFT: "ร่าง", PENDING: "รออนุมัติ", PUBLISHED: "เผยแพร่แล้ว", REJECTED: "ส่งกลับ" };

type Hit = { title: string; subtitle: string; href: string };
export type SearchGroup = { key: "media" | "courses" | "schools" | "users" | "codes"; label: string; hits: Hit[] };

/** Back-office search: media and schools for every manager; members and sign-up codes for admins only. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isManager(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 1) return NextResponse.json({ groups: [] });
  const has = { contains: q, mode: "insensitive" as const };
  const admin = isAdmin(session.user.role);
  const codeKey = q.replace(/[^a-z0-9]/gi, "").toUpperCase(); // codes are stored upper-case without dashes

  const [media, courses, schools, users, codes] = await Promise.all([
    db.media.findMany({
      where: { OR: [{ title: has }, { authorName: has }, { createdBy: { name: has } }] },
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
      select: { id: true, title: true, status: true, area: { select: { name: true } } },
    }),
    db.course.findMany({
      where: { OR: [{ title: has }, { instructorName: has }, { createdBy: { name: has } }] },
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
      select: { id: true, title: true, status: true, area: { select: { name: true } } },
    }),
    db.school.findMany({
      where: { OR: [{ name: has }, { code: { contains: q } }, { district: has }, { center: has }] },
      orderBy: { name: "asc" },
      take: LIMIT,
      select: { id: true, name: true, district: true, code: true },
    }),
    admin
      ? db.user.findMany({
          where: { OR: [{ name: has }, { email: has }, { username: has }, { phone: { contains: q } }] },
          orderBy: { createdAt: "desc" },
          take: LIMIT,
          select: { id: true, name: true, email: true, username: true, memberType: true },
        })
      : [],
    admin
      ? db.registrationCode.findMany({
          where: { OR: codeKey ? [{ label: has }, { code: { contains: codeKey } }] : [{ label: has }] },
          orderBy: { createdAt: "desc" },
          take: LIMIT,
          select: { id: true, label: true, memberType: true, active: true },
        })
      : [],
  ]);

  const groups: SearchGroup[] = [
    { key: "media", label: "คลังสื่อ", hits: media.map((m) => ({ title: m.title, subtitle: `${m.area.name} · ${STATUS[m.status] ?? m.status}`, href: `/admin/media/${m.id}` })) },
    { key: "courses", label: "คอร์สเรียน", hits: courses.map((c) => ({ title: c.title, subtitle: `${c.area.name} · ${COURSE_STATUS[c.status] ?? c.status}`, href: `/admin/courses/${c.id}` })) },
    { key: "schools", label: "โรงเรียน", hits: schools.map((s) => ({ title: s.name, subtitle: `อ.${s.district} · รหัส ${s.code}`, href: `/admin/schools/${s.id}` })) },
    { key: "users", label: "สมาชิก", hits: users.map((u) => ({ title: u.name, subtitle: `${MEMBER_TYPE_LABEL[u.memberType]} · ${u.email ?? u.username ?? "ไม่มีอีเมล"}`, href: `/admin/users/${u.id}` })) },
    { key: "codes", label: "รหัสสมัคร", hits: codes.map((c) => ({ title: c.label, subtitle: `${MEMBER_TYPE_LABEL[c.memberType]}${c.active ? "" : " · ปิดใช้งาน"}`, href: `/admin/registration-codes/${c.id}` })) },
  ];
  return NextResponse.json({ groups: groups.filter((g) => g.hits.length > 0) });
}
