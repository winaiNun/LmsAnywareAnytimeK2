"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enrollAs } from "@/lib/course/course-review";

/** The signed-in member joins a course. The page then shows the "continue" button. */
export async function enroll(courseId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "กรุณาเข้าสู่ระบบก่อนลงทะเบียนเรียน" };
  const r = await enrollAs(session.user.id, courseId);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard/learning");
  return "error" in r ? r : { ok: true };
}
