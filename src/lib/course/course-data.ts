/** Loading courses for the public pages (server only): one select shape, one card shape, used by lists, the home page and admin. */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { MEMBER_TYPE_LABEL, MEMBER_TYPES, type MemberTypeKey } from "@/lib/members";
import { showsOwnerIdentity } from "@/lib/media-access";
import { coverOf } from "./course-server";

export const PER_PAGE = 12;

export const courseCardSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  hours: true,
  instructorName: true,
  publishedAt: true,
  createdAt: true,
  coverKey: true,
  coverDriveId: true,
  coverFx: true,
  coverFy: true,
  audienceTypes: true,
  audienceOnly: true,
  mandatory: true,
  dueAt: true,
  area: { select: { id: true, slug: true, name: true, icon: true, color: true } },
  createdBy: { select: { id: true, name: true, memberType: true } },
  _count: { select: { lessons: true, enrollments: true } },
} satisfies Prisma.CourseSelect;

export type CourseCardRow = Prisma.CourseGetPayload<{ select: typeof courseCardSelect }>;

export type CourseCardData = {
  id: string;
  title: string;
  cover: string | null;
  coverFx: number;
  coverFy: number;
  area: { name: string; icon: string; color: string };
  instructor: string;
  hours: number | null;
  lessons: number;
  learners: number;
  /** Member types the course is for (Thai labels; empty = everyone) and whether it is closed to the others. */
  audience: string[];
  audienceOnly: boolean;
  /** "must take" for the audience, and the finish-by date (ISO) when there is one */
  mandatory: boolean;
  dueAt: string | null;
};

/** The teacher's name as shown to the public; a student creator is shown as "ผู้สอน" only (same privacy rule as media). */
export const instructorOf = (c: Pick<CourseCardRow, "instructorName" | "createdBy">) =>
  c.instructorName?.trim() || (showsOwnerIdentity(c.createdBy.memberType) ? c.createdBy.name : "ผู้สอน");

/** Thai names of the audience, in the usual member-type order. */
export const audienceLabels = (types: readonly string[]): string[] => MEMBER_TYPES.filter((t) => types.includes(t)).map((t) => MEMBER_TYPE_LABEL[t as MemberTypeKey]);

export function toCourseCard(c: CourseCardRow): CourseCardData {
  return {
    id: c.id,
    title: c.title,
    cover: coverOf(c),
    coverFx: c.coverFx,
    coverFy: c.coverFy,
    area: { name: c.area.name, icon: c.area.icon, color: c.area.color },
    instructor: instructorOf(c),
    hours: c.hours,
    lessons: c._count.lessons,
    learners: c._count.enrollments,
    audience: audienceLabels(c.audienceTypes),
    audienceOnly: c.audienceOnly && c.audienceTypes.length > 0,
    mandatory: c.mandatory && c.audienceTypes.length > 0,
    dueAt: c.dueAt ? c.dueAt.toISOString() : null,
  };
}

export type CourseQuery = { q?: string; area?: string; level?: string; page?: number };

/** Public listing: published courses, newest first. */
export async function queryCourses(q: CourseQuery): Promise<{ items: CourseCardData[]; total: number; page: number; pages: number }> {
  const text = q.q?.trim() ?? "";
  const where: Prisma.CourseWhereInput = {
    status: "PUBLISHED",
    ...(q.area && { area: { slug: q.area } }),
    ...(q.level && { levels: { some: { level: { slug: q.level } } } }),
    ...(text && { OR: [{ title: { contains: text, mode: "insensitive" } }, { description: { contains: text, mode: "insensitive" } }, { instructorName: { contains: text, mode: "insensitive" } }] }),
  };
  const total = await db.course.count({ where });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, q.page ?? 1), pages);
  const rows = await db.course.findMany({ where, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: courseCardSelect });
  return { items: rows.map(toCourseCard), total, page, pages };
}

/** Newest published courses (home page). */
export async function latestCourses(limit: number): Promise<CourseCardData[]> {
  const rows = await db.course.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: limit, select: courseCardSelect });
  return rows.map(toCourseCard);
}

/** Published courses with the most learners (home page). */
export async function popularCourses(limit: number): Promise<CourseCardData[]> {
  const rows = await db.course.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ enrollments: { _count: "desc" } }, { publishedAt: "desc" }], take: limit, select: courseCardSelect });
  return rows.map(toCourseCard);
}
