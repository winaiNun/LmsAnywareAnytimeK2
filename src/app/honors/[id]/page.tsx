import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Avatar from "@/components/avatar";
import Breadcrumb from "@/components/breadcrumb";
import CourseCard from "@/components/course-card";
import Glyph from "@/components/glyph";
import { MediaGrid } from "@/components/media-card";
import SiteNavbar from "@/components/site-navbar";
import { courseCardSelect, toCourseCard } from "@/lib/course/course-data";
import { db } from "@/lib/db";
import { getHonorMember } from "@/lib/honors";
import { cardSelect, toCard } from "@/lib/media-data";
import { plainText } from "@/lib/site-texts";
import { getSiteTexts } from "@/lib/site-texts-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const m = await getHonorMember(params.id);
  return { title: m ? m.name : "ไม่พบสมาชิก" };
}

const nf = new Intl.NumberFormat("th-TH");

/** A member's public card: only what they agreed to show, plus their published media and courses. A member who switched it off (or any student) is a plain 404. */
export default async function HonorProfilePage({ params }: { params: { id: string } }) {
  const m = await getHonorMember(params.id);
  if (!m) notFound();
  const [media, courses, texts] = await Promise.all([
    db.media.findMany({ where: { createdById: m.id, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 24, select: cardSelect }),
    db.course.findMany({ where: { createdById: m.id, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 12, select: courseCardSelect }),
    getSiteTexts(),
  ]);

  return (
    <>
      <SiteNavbar />
      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-12 pt-24">
        <Breadcrumb items={[{ label: plainText(texts["honors.title"]), href: "/honors" }, { label: m.name }]} />

        <section className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center shadow-sm sm:flex-row sm:text-left">
          <Avatar avatar={m.avatar} name={m.name} size={112} className="ring-4 ring-brand-soft shadow" />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="break-words text-2xl font-bold">{m.name}</h1>
            {m.position && <p className="text-neutral-600">{m.position}</p>}
            {m.subtitle && <p className="text-neutral-600">{m.subtitle}</p>}
            {m.bio && <p className="pt-1 text-neutral-700">{m.bio}</p>}
            <p className="flex flex-wrap items-center justify-center gap-2 pt-2 text-sm sm:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 font-semibold text-brand"><Glyph name="file-text" size={14} />{nf.format(m.mediaCount)} สื่อ</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 font-semibold text-brand"><Glyph name="play-circle" size={14} />{nf.format(m.courseCount)} คอร์ส</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 font-semibold text-brand"><Glyph name="heart" size={14} />{nf.format(m.likes)} ถูกใจ</span>
              {m.badges.map((b) => <span key={b.key} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800">{b.label}</span>)}
            </p>
          </div>
        </section>

        {courses.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold">คอร์สเรียน</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => <li key={c.id}><CourseCard course={toCourseCard(c)} /></li>)}
            </ul>
          </section>
        )}
        {media.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold">สื่อการเรียนรู้</h2>
            <MediaGrid items={media.map(toCard)} />
          </section>
        )}
        {media.length === 0 && courses.length === 0 && <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-600">ยังไม่มีผลงานที่เผยแพร่</p>}
      </main>
    </>
  );
}
