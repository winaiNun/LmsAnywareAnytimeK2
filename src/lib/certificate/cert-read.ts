import { db } from "@/lib/db";

/** How many learners finished the course but have no certificate row yet (they show as "waiting" and get a row when numbers are issued). */
export async function backfillCertificatesPreview(courseId: string): Promise<number> {
  if ((await db.certificateDesign.count({ where: { courseId } })) === 0) return 0;
  return db.enrollment.count({ where: { courseId, completedAt: { not: null }, user: { certificates: { none: { courseId } } } } });
}
