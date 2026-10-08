import { db } from "@/lib/db";

export type LinkOption = { label: string; url: string };
export type LinkGroup = { label: string; options: LinkOption[] };

/**
 * Everything an admin can point a slide/banner at. Built from the database on each request,
 * so a new course or media item shows up in the picker automatically.
 */
export async function getLinkTargets(): Promise<LinkGroup[]> {
  const [courses, books] = await Promise.all([
    db.course.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, title: true } }),
    db.book.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, title: true } }),
  ]);

  const groups: LinkGroup[] = [
    {
      label: "หน้าในระบบ",
      options: [
        { label: "หน้าแรก", url: "/" },
        { label: "ส่วนสื่อการเรียนรู้ (หน้าแรก)", url: "/#media" },
        { label: "ส่วนคอร์สเรียน (หน้าแรก)", url: "/#courses" },
        { label: "เข้าสู่ระบบ / สมัครสมาชิก", url: "/login" },
      ],
    },
    { label: "คอร์สเรียน", options: courses.map((c) => ({ label: c.title, url: `/courses/${c.id}` })) },
    { label: "สื่อการเรียนรู้", options: books.map((b) => ({ label: b.title, url: `/library/${b.id}` })) },
  ];
  return groups.filter((g) => g.options.length > 0);
}
