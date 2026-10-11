/** Server-only helpers for the course pages: who is signed in, and how a course looks in lists. */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { fileUrl } from "@/lib/site";
import { courseCoverSrc } from "./course-save";
import type { CourseActor } from "./access";

/** The signed-in member as the course permission functions see them, or null. Disabled accounts count as signed out. */
export async function getCourseActor(): Promise<CourseActor | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, creatorStatus: true, active: true, reviewerAreas: { select: { areaId: true } } },
  });
  if (!user || !user.active) return null;
  return { id: user.id, role: user.role, creatorStatus: user.creatorStatus, reviewerAreaIds: user.reviewerAreas.map((r) => r.areaId) };
}

export const COURSE_STATUS_LABEL: Record<string, [string, string]> = {
  DRAFT: ["ร่าง", "bg-neutral-100 text-neutral-600"],
  PENDING: ["รออนุมัติ", "bg-amber-50 text-amber-800"],
  PUBLISHED: ["เผยแพร่แล้ว", "bg-green-50 text-green-700"],
  REJECTED: ["ส่งกลับให้แก้", "bg-red-50 text-red-700"],
};

export const coverOf = (c: { coverKey: string | null; coverDriveId: string | null }, px = 640) => courseCoverSrc(c, fileUrl, px);
