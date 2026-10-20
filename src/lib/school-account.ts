import { db } from "@/lib/db";

/**
 * A school's own login (made when the directory is imported). It exists to keep the school's link and card up to date and to
 * read the school's summary; it is not a person, so it does not enrol in courses, submit media or apply as a creator.
 */
export async function isSchoolAccount(userId: string): Promise<boolean> {
  return !!(await db.school.findUnique({ where: { accountId: userId }, select: { id: true } }));
}

export const SCHOOL_ACCOUNT_NOTE = "บัญชีโรงเรียนใช้สำหรับดูแลข้อมูลโรงเรียนเท่านั้น — ให้ครูและบุคลากรสมัครสมาชิกด้วยบัญชีของตนเอง";
