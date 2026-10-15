import { getCourseActor } from "@/lib/course/course-server";
import { buildQuizImportTemplate } from "@/lib/course/quiz/import-template";

export const dynamic = "force-dynamic";

/** The Excel template for importing multiple-choice questions. Signed-in members only (the same people who can build quizzes). */
export async function GET() {
  const actor = await getCourseActor();
  if (!actor) return new Response("Forbidden", { status: 403 });
  const file = await buildQuizImportTemplate();
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="quiz-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
