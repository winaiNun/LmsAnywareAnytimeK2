/**
 * Sample "outside media sources" so the directory and the footer can be seen (LOCAL database only).
 *   npm run db:demo:resources         -> (re)create 5 sample links
 *   npm run db:demo:resources:clear   -> remove them again
 * Everything it creates has an id starting with "demo_res_"; it refuses to run against a database that is not on this computer.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(url)) {
  console.error("Refusing to run: DATABASE_URL is not a local database. The sample links are for local development only.");
  process.exit(1);
}

const db = new PrismaClient();

const LINKS = [
  { name: "DLTV ครูทีวี", url: "https://www.dltv.ac.th", description: "การศึกษาทางไกลผ่านดาวเทียม ช่องและบทเรียนออนไลน์ตามระดับชั้น", groupName: "วิดีโอ", icon: "play-circle", color: "#E11D48" },
  { name: "ศูนย์เนื้อหาดิจิทัล สพฐ.", url: "https://contentcenter.obec.go.th", description: "รวมสื่อและแหล่งเรียนรู้ดิจิทัลของสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน", groupName: "คลังความรู้", icon: "book-open", color: "#0052FF" },
  { name: "สถาบันส่งเสริมการสอนวิทยาศาสตร์และเทคโนโลยี (สสวท.)", url: "https://www.ipst.ac.th", description: "สื่อและแหล่งเรียนรู้คณิตศาสตร์ วิทยาศาสตร์ และเทคโนโลยี", groupName: "คลังความรู้", icon: "flask", color: "#059669" },
  { name: "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน", url: "https://www.obec.go.th", description: "ข่าวสาร นโยบาย และบริการของ สพฐ.", groupName: "หน่วยงาน", icon: "globe", color: "#7C3AED" },
  { name: "YouTube", url: "https://www.youtube.com", description: "วิดีโอการเรียนรู้จากช่องของครูและหน่วยงานต่างๆ", groupName: "วิดีโอ", icon: "youtube", color: "#DC2626" },
];

async function main() {
  await db.resourceLink.deleteMany({ where: { id: { startsWith: "demo_res_" } } });
  if (process.argv.includes("--clear")) {
    console.log("Removed the sample links.");
    return;
  }
  const last = await db.resourceLink.aggregate({ _max: { sortOrder: true } });
  const start = (last._max.sortOrder ?? 0) + 1;
  for (const [i, l] of LINKS.entries()) await db.resourceLink.create({ data: { id: `demo_res_${i + 1}`, sortOrder: start + i, clickCount: [128, 96, 64, 22, 40][i], ...l } });
  console.log(`Created ${LINKS.length} sample links.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
