"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { confirmLessonAs, startAttemptAs, submitAttemptAs } from "@/lib/course/course-learn";

const NOT_SIGNED_IN = { error: "กรุณาเข้าสู่ระบบ" } as const;

async function userId() {
  const session = await getServerSession(authOptions);
  return session?.user.id ?? null;
}

function refresh(courseId: string) {
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard/learning");
}

/** "I have studied this lesson". */
export async function confirmLesson(courseId: string, lessonId: string) {
  const id = await userId();
  if (!id) return NOT_SIGNED_IN;
  const r = await confirmLessonAs(id, courseId, lessonId);
  refresh(courseId);
  return r;
}

export async function startQuiz(quizId: string) {
  const id = await userId();
  if (!id) return NOT_SIGNED_IN;
  return startAttemptAs(id, quizId);
}

export async function submitQuiz(courseId: string, attemptId: string, answers: Record<string, unknown>) {
  const id = await userId();
  if (!id) return NOT_SIGNED_IN;
  const r = await submitAttemptAs(id, attemptId, answers);
  refresh(courseId);
  return r;
}
