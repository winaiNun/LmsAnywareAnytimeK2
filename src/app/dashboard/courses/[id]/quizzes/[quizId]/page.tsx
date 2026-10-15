import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canEditCourse } from "@/lib/course/access";
import { getCourseActor } from "@/lib/course/course-server";
import type { QuestionRow } from "@/lib/course/quiz/grade";
import { presentQuiz } from "@/lib/course/quiz/present";
import { parseQuestion } from "@/lib/course/quiz/schemas";
import { db } from "@/lib/db";
import { Questions, QuizSettings, TryIt } from "./quiz-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "แก้ไขแบบทดสอบ" };

export default async function EditQuizPage({ params }: { params: { id: string; quizId: string } }) {
  const actor = await getCourseActor();
  if (!actor) redirect(`/login?callbackUrl=/dashboard/courses/${params.id}/quizzes/${params.quizId}`);
  const quiz = await db.quiz.findFirst({
    where: { id: params.quizId, courseId: params.id },
    include: { questions: { orderBy: { sortOrder: "asc" } }, course: { select: { id: true, title: true, createdById: true, areaId: true } } },
  });
  if (!quiz || !canEditCourse(actor, quiz.course)) notFound();

  const rows = quiz.questions as unknown as QuestionRow[];
  // a fresh random order on every visit; only questions with a complete answer key can be tried
  const tryable = presentQuiz(rows.filter((q) => parseQuestion(q.type, q.config, q.answerKey).ok), { seed: Math.floor(Math.random() * 2 ** 31), shuffleQuestions: quiz.shuffleQuestions, shuffleChoices: quiz.shuffleChoices });

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <Link href={`/dashboard/courses/${params.id}/edit?tab=quizzes`} className="text-sm text-brand">← {quiz.course.title}</Link>
        <h1 className="text-2xl font-bold">{quiz.title}</h1>
      </div>
      <QuizSettings courseId={params.id} questions={quiz.questions.map((q) => ({ type: q.type, config: q.config, explanation: q.explanation }))} quiz={{ id: quiz.id, title: quiz.title, passPercent: quiz.passPercent, maxAttempts: quiz.maxAttempts, timeLimitMin: quiz.timeLimitMin, shuffleQuestions: quiz.shuffleQuestions, shuffleChoices: quiz.shuffleChoices, showAnswers: quiz.showAnswers }} />
      <Questions
        courseId={params.id}
        quizId={quiz.id}
        questions={quiz.questions.map((q) => ({ id: q.id, type: q.type, points: q.points, prompt: q.prompt, imageUrl: q.imageUrl ?? "", explanation: q.explanation, config: q.config, answerKey: q.answerKey }))}
      />
      <TryIt key={tryable.map((q) => q.id).join()} courseId={params.id} quizId={quiz.id} questions={tryable} timeLimitMin={quiz.timeLimitMin} />
    </main>
  );
}
