import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asLearnerStatus } from "@/lib/course/course-learners";
import { canEditCourse } from "@/lib/course/access";
import { readinessOf } from "@/lib/course/course-save";
import { COURSE_STATUS_LABEL, coverOf, getCourseActor } from "@/lib/course/course-server";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/media-data";
import { storageIsDurable } from "@/lib/schools";
import { getSiteInfo } from "@/lib/site";
import { getSiteTexts } from "@/lib/site-texts-server";
import CourseInfoForm from "../../course-info-form";
import ContentEditor from "./content-editor";
import CertificateTab from "./certificate-tab";
import LearnersTab from "./learners-tab";
import QuizzesTab from "./quizzes-tab";
import SubmitTab from "./submit-tab";

export const dynamic = "force-dynamic";
export const metadata = { title: "แก้ไขคอร์ส" };

const TABS = [
  { key: "info", label: "ข้อมูลคอร์ส" },
  { key: "content", label: "บทเรียน" },
  { key: "quizzes", label: "แบบทดสอบ" },
  { key: "submit", label: "ส่งตรวจ" },
  { key: "learners", label: "ผู้เรียน" },
  { key: "certificate", label: "เกียรติบัตร" },
] as const;

export default async function EditCoursePage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; created?: string; q?: string; status?: string; page?: string; design?: string } }) {
  const actor = await getCourseActor();
  if (!actor) redirect(`/login?callbackUrl=/dashboard/courses/${params.id}/edit`);
  const course = await db.course.findUnique({
    where: { id: params.id },
    include: {
      levels: true,
      lessons: { orderBy: { position: "asc" }, include: { section: { select: { title: true } }, _count: { select: { blocks: true } } } },
      quizzes: { orderBy: { createdAt: "asc" }, include: { _count: { select: { questions: true, blocks: true } } } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course || !canEditCourse(actor, course)) notFound();
  const tab = TABS.some((t) => t.key === searchParams.tab) ? (searchParams.tab as (typeof TABS)[number]["key"]) : "info";
  const [label, tone] = COURSE_STATUS_LABEL[course.status];
  const admin = actor.role === "ADMIN";
  const [{ areas, levels }, site, texts, problems] = await Promise.all([getFormOptions(), getSiteInfo(), getSiteTexts(), tab === "submit" ? readinessOf(course.id) : Promise.resolve([] as string[])]);
  const base = `/dashboard/courses/${course.id}/edit`;

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/dashboard/courses" className="text-sm text-brand">← คอร์สของฉัน</Link>
          <Link href="/dashboard/courses/guide" className="text-sm text-brand hover:underline">{texts["guide.creator"]} →</Link>
        </div>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold"><span className="min-w-0 break-words">{course.title}</span><span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{label}</span></h1>
        {searchParams.created && <p role="status" className="mt-2 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800">สร้างคอร์สแล้ว — เพิ่มบทเรียนด้านล่างได้เลย</p>}
      </div>

      <nav aria-label="ขั้นตอนการสร้างคอร์ส" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {TABS.map((t, i) => (
          <Link key={t.key} href={`${base}?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm ${tab === t.key ? "border-brand bg-brand-soft font-semibold text-brand" : "border-neutral-300 bg-white"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${tab === t.key ? "bg-brand text-white" : "bg-neutral-100 text-neutral-600"}`}>{i + 1}</span>{t.label}
          </Link>
        ))}
      </nav>

      {tab === "info" && (
        <CourseInfoForm
          values={{
            id: course.id, title: course.title, description: course.description, areaId: course.areaId, levelIds: course.levels.map((l) => l.levelId),
            instructorName: course.instructorName ?? "", hours: course.hours === null ? "" : String(course.hours), enrollOpen: course.enrollOpen, audienceTypes: course.audienceTypes, audienceOnly: course.audienceOnly,
            coverUrl: coverOf(course), coverDrive: course.coverDriveId ? `https://drive.google.com/file/d/${course.coverDriveId}/view` : "", coverFx: course.coverFx, coverFy: course.coverFy,
          }}
          areas={areas}
          levels={levels}
          allowUpload={site.allowServerUploads && storageIsDurable()}
        />
      )}
      {tab === "content" && <ContentEditor courseId={course.id} lessons={course.lessons.map((l) => ({ id: l.id, title: l.title, sectionTitle: l.section?.title ?? null, blockCount: l._count.blocks, required: l.required, unlockRule: l.unlockRule }))} />}
      {tab === "quizzes" && <QuizzesTab courseId={course.id} quizzes={course.quizzes.map((q) => ({ id: q.id, title: q.title, questionCount: q._count.questions, passPercent: q.passPercent, usedInLessons: q._count.blocks }))} />}
      {tab === "learners" && <LearnersTab courseId={course.id} q={searchParams.q ?? ""} status={asLearnerStatus(searchParams.status)} page={Math.max(1, Number(searchParams.page) || 1)} />}
      {tab === "certificate" && <CertificateTab courseId={course.id} isAdmin={admin} designId={searchParams.design} status={searchParams.status} />}
      {tab === "submit" && <SubmitTab courseId={course.id} status={course.status} problems={problems} isAdmin={admin} selfPublish={!!actor.selfPublish} reviewNote={course.reviewNote} enrollments={course._count.enrollments} />}
    </main>
  );
}
