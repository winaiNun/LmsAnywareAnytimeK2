import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const LEARNER_STATUSES = ["all", "done", "learning", "new"] as const;
export type LearnerStatus = (typeof LEARNER_STATUSES)[number];
export const LEARNER_STATUS_LABEL: Record<LearnerStatus, string> = { all: "ทั้งหมด", done: "เรียนจบแล้ว", learning: "กำลังเรียน", new: "ยังไม่เริ่ม" };
export const LEARNERS_PER_PAGE = 30;

export const asLearnerStatus = (v: string | undefined): LearnerStatus => (LEARNER_STATUSES as readonly string[]).includes(v ?? "") ? (v as LearnerStatus) : "all";

function whereOf(courseId: string, q: string, status: LearnerStatus): Prisma.EnrollmentWhereInput {
  const term = q.trim();
  return {
    courseId,
    ...(status === "done" && { completedAt: { not: null } }),
    ...(status === "learning" && { completedAt: null, progress: { gt: 0 } }),
    ...(status === "new" && { completedAt: null, progress: 0 }),
    ...(term && {
      user: {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { organization: { contains: term, mode: "insensitive" } },
          { memberSchool: { name: { contains: term, mode: "insensitive" } } },
        ],
      },
    }),
  };
}

const userSelect = { name: true, memberType: true, organization: true, position: true, memberSchool: { select: { name: true, district: true } } } as const;

/** One page of a course's learners (newest activity first) + the counts for the filter chips. */
export async function listLearners(courseId: string, opts: { q?: string; status?: LearnerStatus; page?: number }) {
  const status = opts.status ?? "all";
  const where = whereOf(courseId, opts.q ?? "", status);
  const [total, rows, all, done, learning] = await Promise.all([
    db.enrollment.count({ where }),
    db.enrollment.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: ((opts.page ?? 1) - 1) * LEARNERS_PER_PAGE,
      take: LEARNERS_PER_PAGE,
      select: { id: true, progress: true, completedAt: true, createdAt: true, updatedAt: true, user: { select: userSelect } },
    }),
    db.enrollment.count({ where: { courseId } }),
    db.enrollment.count({ where: { courseId, completedAt: { not: null } } }),
    db.enrollment.count({ where: { courseId, completedAt: null, progress: { gt: 0 } } }),
  ]);
  return { total, rows, counts: { all, done, learning, new: all - done - learning }, pages: Math.max(1, Math.ceil(total / LEARNERS_PER_PAGE)) };
}

/** Everyone matching the filter, for the spreadsheet export (capped so a huge course cannot hurt the server). */
export async function allLearners(courseId: string, opts: { q?: string; status?: LearnerStatus }) {
  return db.enrollment.findMany({
    where: whereOf(courseId, opts.q ?? "", opts.status ?? "all"),
    orderBy: [{ completedAt: "asc" }, { createdAt: "asc" }],
    take: 5000,
    select: { progress: true, completedAt: true, createdAt: true, updatedAt: true, user: { select: userSelect } },
  });
}
