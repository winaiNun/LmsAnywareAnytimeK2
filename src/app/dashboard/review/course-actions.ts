"use server";

import { revalidatePath } from "next/cache";
import { setEnrollOpenAs, reviewCourseAs, unpublishCourseAs } from "@/lib/course/course-review";
import { getCourseActor } from "@/lib/course/course-server";

const NOT_SIGNED_IN = { error: "กรุณาเข้าสู่ระบบ" };

function refresh(id: string) {
  for (const p of ["/dashboard/review/courses", "/dashboard/courses", "/admin/courses", "/courses", "/", `/courses/${id}`, `/admin/courses/${id}`, `/dashboard/review/courses/${id}`]) revalidatePath(p);
}

export async function reviewCourse(id: string, decision: "approve" | "reject", note: string): Promise<{ error?: string }> {
  const actor = await getCourseActor();
  if (!actor) return NOT_SIGNED_IN;
  const r = await reviewCourseAs(actor, id, decision, note);
  refresh(id);
  return "error" in r ? r : {};
}

export async function unpublishCourse(id: string): Promise<{ error?: string }> {
  const actor = await getCourseActor();
  if (!actor) return NOT_SIGNED_IN;
  const r = await unpublishCourseAs(actor, id);
  refresh(id);
  return "error" in r ? r : {};
}

export async function setCourseEnrollOpen(id: string, open: boolean): Promise<{ error?: string }> {
  const actor = await getCourseActor();
  if (!actor) return NOT_SIGNED_IN;
  const r = await setEnrollOpenAs(actor, id, open);
  refresh(id);
  return "error" in r ? r : {};
}
