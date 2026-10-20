/**
 * Sample members for the honours page (LOCAL database only).
 *   npm run db:demo:honors         -> (re)create 20 sample members with published media / courses
 *   npm run db:demo:honors:clear   -> remove them again
 * Every row has an id starting with "demo_hn_" so real data is never touched, and the script refuses to run
 * against any database that is not on this computer. All names are made up.
 *
 * The mix is chosen to exercise the privacy rules: students that "agreed" (must still never appear), a member
 * who did not agree, one hidden by an admin, and members who hide their photo or school.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { getStorage } from "../src/lib/storage";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(url)) {
  console.error("Refusing to run: DATABASE_URL is not a local database. The sample members are for local development only.");
  process.exit(1);
}

const db = new PrismaClient();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const COLORS = ["#2563EB", "#059669", "#D97706", "#9333EA", "#DC2626", "#0891B2", "#4F46E5", "#EA580C", "#475569", "#BE185D"];

type M = {
  prefix: string; first: string; last: string; type: "TEACHER" | "SUPERVISOR" | "GENERAL" | "STUDENT";
  media: number; courses: number; joined: number; // days ago
  consent?: boolean; hidden?: boolean; photo?: boolean; school?: boolean; bio?: string; position?: string; noAvatar?: boolean; drafts?: number;
};

const MEMBERS: M[] = [
  { prefix: "นาง", first: "สมศรี", last: "รักเรียน", type: "TEACHER", media: 24, courses: 5, joined: 700, bio: "รักการสร้างสื่อให้เด็กๆ ได้เล่นและเรียนรู้ไปพร้อมกัน", position: "ครูชำนาญการพิเศษ" },
  { prefix: "นาย", first: "ประสิทธิ์", last: "นิเทศดี", type: "SUPERVISOR", media: 17, courses: 4, joined: 650, position: "ศึกษานิเทศก์ชำนาญการพิเศษ" },
  { prefix: "นางสาว", first: "วิภา", last: "ใจดี", type: "TEACHER", media: 15, courses: 2, joined: 420, bio: "ครูคณิตศาสตร์ที่เชื่อว่าเลขสนุกได้", position: "ครูชำนาญการ" },
  { prefix: "นาย", first: "ธนากร", last: "ตั้งมั่น", type: "TEACHER", media: 12, courses: 6, joined: 380, position: "ครูชำนาญการ" },
  { prefix: "นาง", first: "จันทร์เพ็ญ", last: "ศรีสุข", type: "TEACHER", media: 9, courses: 1, joined: 300, school: false, bio: "แบ่งปันแผนการสอนภาษาไทย" },
  { prefix: "นาย", first: "อนุชา", last: "พัฒนา", type: "TEACHER", media: 8, courses: 0, joined: 260, photo: false },
  { prefix: "นางสาว", first: "พิมพ์ใจ", last: "แก้วมณี", type: "TEACHER", media: 6, courses: 3, joined: 80, bio: "เพิ่งเริ่มสร้างคอร์สครั้งแรก" },
  { prefix: "นาย", first: "สุรชัย", last: "วงศ์ใหญ่", type: "SUPERVISOR", media: 5, courses: 2, joined: 200 },
  { prefix: "นางสาว", first: "ณัฐธิดา", last: "สายบุญ", type: "TEACHER", media: 4, courses: 0, joined: 45, noAvatar: true },
  { prefix: "นาย", first: "กิตติพงษ์", last: "เรืองแสง", type: "TEACHER", media: 3, courses: 1, joined: 30, noAvatar: true },
  { prefix: "นาง", first: "รัตนา", last: "ทองแท้", type: "TEACHER", media: 2, courses: 0, joined: 20 },
  { prefix: "นาย", first: "สมชาย", last: "ทองดี", type: "GENERAL", media: 2, courses: 1, joined: 55, position: "วิทยากรอิสระ" },
  { prefix: "นางสาว", first: "กนกวรรณ", last: "ใฝ่รู้", type: "SUPERVISOR", media: 1, courses: 0, joined: 15, noAvatar: true },
  { prefix: "นาย", first: "ปกรณ์", last: "มีสุข", type: "TEACHER", media: 1, courses: 0, joined: 5, noAvatar: true },
  { prefix: "นาง", first: "อรทัย", last: "สว่างจิต", type: "TEACHER", media: 0, courses: 0, joined: 10, noAvatar: true },
  // not on the page: did not agree / hidden by an admin
  { prefix: "นาย", first: "วีระ", last: "ไม่แสดงตัว", type: "TEACHER", media: 20, courses: 3, joined: 500, consent: false },
  { prefix: "นาง", first: "มาลี", last: "ถูกซ่อน", type: "TEACHER", media: 14, courses: 2, joined: 450, hidden: true },
  { prefix: "นาย", first: "บุญมา", last: "ส่วนตัว", type: "GENERAL", media: 7, courses: 0, joined: 120, consent: false },
  // students "agreed" in the database; they must NEVER appear, whatever the flag says
  { prefix: "เด็กชาย", first: "ธนา", last: "ตั้งใจเรียน", type: "STUDENT", media: 6, courses: 0, joined: 90 },
  { prefix: "เด็กหญิง", first: "ใจดี", last: "เรียนเก่ง", type: "STUDENT", media: 3, courses: 0, joined: 40 },
];

const avatarSvg = (c: string, initial: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="${c}"/><text x="256" y="340" font-size="250" font-weight="700" fill="#fff" text-anchor="middle" font-family="Leelawadee UI, Tahoma, Sarabun, sans-serif">${initial}</text></svg>`;

async function clear() {
  const users = await db.user.findMany({ where: { id: { startsWith: "demo_hn_" } }, select: { avatarKey: true } });
  await db.media.deleteMany({ where: { id: { startsWith: "demo_hn_" } } });
  await db.course.deleteMany({ where: { id: { startsWith: "demo_hn_" } } });
  await db.user.deleteMany({ where: { id: { startsWith: "demo_hn_" } } });
  const storage = getStorage();
  for (const u of users) if (u.avatarKey) await storage.delete(u.avatarKey).catch(() => {});
}

async function main() {
  await clear();
  if (process.argv.includes("--clear")) {
    console.log("Demo honours members removed.");
    return;
  }
  const storage = getStorage();
  const areas = await db.learningArea.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  const type = await db.mediaType.findFirst({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  const schools = await db.school.findMany({ orderBy: { code: "asc" }, take: 8, select: { id: true } });
  if (!areas.length) throw new Error("No learning areas found - run the migrations first.");
  const hash = await bcrypt.hash("Demo12345!", 8);

  let nMedia = 0;
  let nCourses = 0;
  for (const [i, m] of MEMBERS.entries()) {
    const id = `demo_hn_${String(i + 1).padStart(2, "0")}`;
    let avatarKey: string | null = null;
    if (!m.noAvatar) {
      avatarKey = `avatars/demo-${id}-${randomUUID().slice(0, 6)}.webp`;
      await storage.put(avatarKey, await sharp(Buffer.from(avatarSvg(COLORS[i % COLORS.length], m.first[0])), { density: 96 }).webp({ quality: 80 }).toBuffer(), "image/webp");
    }
    const isStudent = m.type === "STUDENT";
    await db.user.create({
      data: {
        id,
        username: `demo.hn${i + 1}`,
        name: `${m.prefix}${m.first} ${m.last}`,
        prefix: m.prefix,
        firstName: m.first,
        lastName: m.last,
        memberType: m.type,
        passwordHash: hash,
        avatarKey,
        position: m.position ?? null,
        schoolId: m.type === "TEACHER" || isStudent ? schools[i % Math.max(1, schools.length)]?.id ?? null : null,
        organization: m.type === "SUPERVISOR" ? "สพป.ตัวอย่าง" : null,
        showInHonors: m.consent ?? true,
        honorsHidden: m.hidden ?? false,
        honorsShowPhoto: m.photo ?? true,
        honorsShowSchool: m.school ?? true,
        honorsBio: m.bio ?? null,
        createdAt: daysAgo(m.joined),
      },
    });
    for (let k = 0; k < m.media + (m.drafts ?? 0); k++) {
      const published = k < m.media;
      const likes = published ? Math.round((m.media - k) * 2.5 + ((i * 7 + k * 3) % 9)) : 0;
      await db.media.create({
        data: {
          id: `demo_hn_m_${i + 1}_${k}`,
          title: `[สื่อตัวอย่าง] ${m.first} ชิ้นที่ ${k + 1}`,
          description: "ข้อมูลจำลองสำหรับทดสอบหน้าเชิดชู",
          areaId: areas[(i + k) % areas.length].id,
          typeId: type?.id,
          status: published ? "PUBLISHED" : "DRAFT",
          publishedAt: published ? daysAgo(Math.min(m.joined - 1, 5 + k * 17 + (i % 5) * 3)) : null,
          createdById: id,
          likeCount: likes,
          viewCount: published ? likes * 11 + 40 : 0,
        },
      });
      if (published) nMedia++;
    }
    for (let k = 0; k < m.courses; k++) {
      await db.course.create({
        data: {
          id: `demo_hn_c_${i + 1}_${k}`,
          title: `[คอร์สตัวอย่าง] ${m.first} คอร์สที่ ${k + 1}`,
          areaId: areas[(i + k + 2) % areas.length].id,
          status: "PUBLISHED",
          publishedAt: daysAgo(Math.min(m.joined - 1, 10 + k * 25)),
          createdById: id,
        },
      });
      nCourses++;
    }
  }
  console.log(`Demo honours members created: ${MEMBERS.length} members, ${nMedia} published media, ${nCourses} published courses.`);
  console.log("Visible on the page: 15 (agreed, not hidden, not students). Not visible: 2 did not agree (1 teacher, 1 general), 1 hidden by an admin, 2 students (flag on, still never shown).");
  console.log("Sample members sign in as demo.hn1 ... demo.hn20 (password Demo12345!).");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
