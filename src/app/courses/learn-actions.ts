"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { confirmCertificate } from "@/lib/certificate/cert-store";
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

/** "ตรวจชื่อแล้ว รับเกียรติบัตร": the signed-in learner takes the next number of an automatic series (only for their own certificate). */
export async function confirmCertificateAction(courseId: string): Promise<{ ok: true; number: string | null } | { ok: false; error: string }> {
  const id = await userId();
  if (!id) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  const r = await confirmCertificate(id, courseId);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard/certificates");
  return r;
}
