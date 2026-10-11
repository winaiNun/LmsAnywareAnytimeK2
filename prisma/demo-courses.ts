/**
 * Sample courses so the course pages can be seen with real-looking content (LOCAL database only).
 *   npm run db:demo:courses         -> (re)create 3 published courses (one with a quiz of every question type) + 1 waiting for review
 *   npm run db:demo:courses:clear   -> remove them again
 * Everything it creates has an id starting with "demo_course_"; it refuses to run against a database that is not on this computer.
 */
import { PrismaClient } from "@prisma/client";
import { stateToQuestion, type EditorState } from "../src/lib/course/quiz/editor-model";
import { parseQuestion } from "../src/lib/course/quiz/schemas";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(url)) {
  console.error("Refusing to run: DATABASE_URL is not a local database. The sample courses are for local development only.");
  process.exit(1);
}

const db = new PrismaClient();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const YT = ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=9bZkp7q19f0", "https://www.youtube.com/watch?v=jNQXAC9IVRw"];

const s = (e: EditorState) => {
  const q = stateToQuestion(e);
  const p = parseQuestion(e.type, q.config, q.answerKey);
  if (!p.ok) throw new Error(`${e.type}: ${p.error}`);
  return { type: e.type, config: q.config, answerKey: q.answerKey };
};

const QUESTIONS: { prompt: string; points: number; explanation: string; state: EditorState }[] = [
  { prompt: "เมืองหลวงของประเทศไทยคือข้อใด", points: 2, explanation: "กรุงเทพมหานครเป็นเมืองหลวงของประเทศไทย", state: { type: "SINGLE", choices: [{ id: "c1", text: "เชียงใหม่" }, { id: "c2", text: "กรุงเทพมหานคร" }, { id: "c3", text: "ภูเก็ต" }], correct: "c2" } },
  { prompt: "ข้อใดเป็นจำนวนเฉพาะ (เลือกได้หลายข้อ)", points: 3, explanation: "จำนวนเฉพาะมีตัวหารเพียง 1 และตัวมันเอง", state: { type: "MULTI", choices: [{ id: "c1", text: "2" }, { id: "c2", text: "9" }, { id: "c3", text: "7" }, { id: "c4", text: "15" }], correct: ["c1", "c3"], scoring: "partial" } },
  { prompt: "น้ำเดือดที่ 100 องศาเซลเซียสที่ระดับน้ำทะเล", points: 1, explanation: "", state: { type: "TRUEFALSE", value: true } },
  { prompt: "จังหวัดที่มีพื้นที่ใหญ่ที่สุดของประเทศไทยคือจังหวัดอะไร", points: 2, explanation: "นครราชสีมา หรือ \"โคราช\" มีพื้นที่ใหญ่ที่สุด", state: { type: "SHORT", accepted: "นครราชสีมา\nโคราช", ignoreSpaces: true, caseSensitive: false, placeholder: "พิมพ์ชื่อจังหวัด" } },
  { prompt: "12 × 12 เท่ากับเท่าไร", points: 2, explanation: "", state: { type: "NUMBER", value: "144", tolerance: "0", unit: "" } },
  { prompt: "จับคู่ประเทศกับเมืองหลวง", points: 3, explanation: "", state: { type: "MATCH", rows: [{ id: "a", left: "ญี่ปุ่น", right: "โตเกียว" }, { id: "b", left: "อังกฤษ", right: "ลอนดอน" }, { id: "c", left: "ฝรั่งเศส", right: "ปารีส" }], distractors: "โซล" } },
  { prompt: "เรียงขั้นตอนการเขียนรายงานให้ถูกต้อง", points: 3, explanation: "", state: { type: "ORDER", items: [{ id: "a", text: "ตั้งหัวข้อ" }, { id: "b", text: "ค้นคว้าข้อมูล" }, { id: "c", text: "เขียนเรียบเรียง" }, { id: "d", text: "ตรวจทานและส่ง" }] } },
  { prompt: "จัดสิ่งต่อไปนี้เข้าหมวดที่ถูกต้อง", points: 4, explanation: "", state: { type: "CATEGORIZE", categories: [{ id: "k1", text: "สัตว์" }, { id: "k2", text: "ผลไม้" }], items: [{ id: "i1", text: "แมว", categoryId: "k1" }, { id: "i2", text: "มะม่วง", categoryId: "k2" }, { id: "i3", text: "ช้าง", categoryId: "k1" }, { id: "i4", text: "กล้วย", categoryId: "k2" }] } },
  { prompt: "เติมคำให้สมบูรณ์", points: 2, explanation: "", state: { type: "CLOZE", text: "ประเทศไทยมีเมืองหลวงชื่อ {{1}} และอยู่ในภูมิภาค {{2}}", blanks: [{ id: "1", mode: "type", accepted: "กรุงเทพ\nกรุงเทพมหานคร", options: "", correct: 0 }, { id: "2", mode: "choose", accepted: "", options: "เหนือ\nกลาง\nใต้", correct: 1 }] } },
];

async function clear() {
  await db.course.deleteMany({ where: { id: { startsWith: "demo_course_" } } });
}

async function main() {
  await clear();
  if (process.argv.includes("--clear")) {
    console.log("Removed the sample courses.");
    return;
  }
  const teacher = await db.user.findFirst({ where: { role: "TEACHER", active: true }, orderBy: { createdAt: "asc" } });
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, orderBy: { createdAt: "asc" } });
  if (!teacher || !admin) throw new Error("Need a teacher and an admin account first (npm run db:demo).");

  const mk = async (n: number, d: { title: string; description: string; area: string; levels: string[]; status: "PUBLISHED" | "PENDING"; hours: number; days: number; setup?: (courseId: string) => Promise<void>; lessons: { title: string; section?: string; rule?: "OPEN" | "AFTER_PREVIOUS"; blocks: object[] }[] }) => {
    const id = `demo_course_${n}`;
    await db.course.create({
      data: {
        id, title: d.title, description: d.description, areaId: d.area, status: d.status, hours: d.hours, instructorName: "ครูผู้สอนตัวอย่าง", createdById: teacher.id,
        publishedAt: d.status === "PUBLISHED" ? daysAgo(d.days) : null, reviewedById: d.status === "PUBLISHED" ? admin.id : null, reviewedAt: d.status === "PUBLISHED" ? daysAgo(d.days) : null, createdAt: daysAgo(d.days + 2),
        levels: { create: d.levels.map((levelId) => ({ levelId })) },
      },
    });
    if (d.setup) await d.setup(id); // e.g. the quiz a lesson points at
    const sections = new Map<string, string>();
    for (const [i, l] of d.lessons.entries()) {
      let sectionId: string | null = null;
      if (l.section) {
        if (!sections.has(l.section)) sections.set(l.section, (await db.courseSection.create({ data: { courseId: id, title: l.section, sortOrder: sections.size + 1 } })).id);
        sectionId = sections.get(l.section)!;
      }
      await db.lesson.create({ data: { id: `${id}_l${i + 1}`, courseId: id, title: l.title, position: i + 1, unlockRule: l.rule ?? "OPEN", sectionId, blocks: { create: (l.blocks as { kind: "VIDEO" | "LINK" | "TEXT" | "QUIZ"; [k: string]: unknown }[]).map((b, j) => ({ ...b, sortOrder: j + 1 })) as never } } });
    }
    return id;
  };

  // 1) a course with a quiz of every type
  const c1 = "demo_course_1";
  await mk(1, {
    title: "ทักษะการเรียนรู้ในศตวรรษที่ 21 (มีแบบทดสอบครบทุกชนิด)", description: "คอร์สตัวอย่างสำหรับดูหน้าตาระบบ มีวิดีโอ ข้อความอธิบาย และแบบฝึกหัดทุกรูปแบบที่ระบบตรวจให้อัตโนมัติ", area: "area_career", levels: ["level_primary", "level_lower"], status: "PUBLISHED", hours: 2, days: 6,
    setup: async (cid) => {
      const quiz = await db.quiz.create({ data: { id: `${cid}_q1`, courseId: cid, title: "แบบทดสอบครบทุกชนิดคำถาม", passPercent: 60, maxAttempts: 5, shuffleQuestions: true, shuffleChoices: true, showAnswers: "AFTER_PASS" } });
      for (const [i, q] of QUESTIONS.entries()) {
        const k = s(q.state);
        await db.question.create({ data: { quizId: quiz.id, type: k.type, sortOrder: i + 1, points: q.points, prompt: q.prompt, explanation: q.explanation, config: k.config, answerKey: k.answerKey } });
      }
    },
    lessons: [
      { title: "บทนำ: การเรียนรู้ตลอดชีวิต", section: "ตอนที่ 1 พื้นฐาน", blocks: [{ kind: "VIDEO", label: "วิดีโอแนะนำ", url: YT[0], required: true, minPercent: 80 }, { kind: "TEXT", label: "สรุป", text: "## ประเด็นสำคัญ\n- การเรียนรู้เกิดขึ้นได้ทุกที่ ทุกเวลา\n- ตั้งเป้าหมายเล็กๆ ที่ทำได้จริง\n\nอ่านเพิ่มเติมได้ที่ [คลังสื่อ](/library)", required: false }] },
      { title: "ฝึกคิดและแก้ปัญหา", section: "ตอนที่ 1 พื้นฐาน", rule: "AFTER_PREVIOUS", blocks: [{ kind: "VIDEO", url: YT[1], required: true }, { kind: "TEXT", text: "ลองสังเกตว่าวิดีโอใช้วิธีใดในการอธิบายปัญหา แล้วจดไว้ 3 ข้อ", required: true }] },
      { title: "แบบฝึกหัดท้ายตอน", section: "ตอนที่ 2 ทบทวน", rule: "AFTER_PREVIOUS", blocks: [{ kind: "QUIZ", label: "ทดสอบความเข้าใจ", required: true, quizId: `${c1}_q1` }] },
    ],
  });

  await mk(2, {
    title: "การใช้ Google Workspace เพื่อการเรียนการสอน", description: "แนะนำเครื่องมือของ Google สำหรับครู: Docs, Sheets, Slides และ Forms พร้อมตัวอย่างการใช้งานในชั้นเรียน", area: "area_teacher", levels: ["level_primary"], status: "PUBLISHED", hours: 4, days: 3,
    lessons: [
      { title: "ภาพรวมเครื่องมือ", blocks: [{ kind: "VIDEO", url: YT[2], required: true }] },
      { title: "สร้างแบบฟอร์มเก็บข้อมูล", rule: "AFTER_PREVIOUS", blocks: [{ kind: "LINK", label: "ตัวอย่างฟอร์ม", url: "https://forms.google.com", required: true }, { kind: "TEXT", text: "ขั้นตอน:\n- เปิด Google Forms\n- ตั้งชื่อฟอร์ม\n- เพิ่มคำถาม", required: true }] },
    ],
  });
  await mk(3, {
    title: "ภาษาอังกฤษเพื่อการสื่อสารในห้องเรียน", description: "ประโยคและคำศัพท์ที่ครูใช้บ่อยในห้องเรียน พร้อมฝึกออกเสียง", area: "area_foreign", levels: ["level_primary", "level_lower"], status: "PUBLISHED", hours: 1.5, days: 1,
    lessons: [{ title: "Greetings", blocks: [{ kind: "VIDEO", url: YT[0], required: true }] }],
  });
  await mk(4, {
    title: "คอร์สรอตรวจ: การวัดและประเมินผลการเรียนรู้", description: "คอร์สตัวอย่างที่อยู่ในคิวรอผู้ตรวจ", area: "area_math", levels: ["level_primary"], status: "PENDING", hours: 3, days: 0,
    lessons: [{ title: "หลักการวัดผล", blocks: [{ kind: "TEXT", text: "เนื้อหาบทแรก", required: true }] }],
  });
  console.log("Created 4 sample courses (3 published, 1 waiting for review). Teacher:", teacher.username ?? teacher.email);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
