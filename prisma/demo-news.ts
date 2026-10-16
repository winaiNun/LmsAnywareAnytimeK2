/**
 * Sample news tabs and links so the home-page news block and /news can be seen (LOCAL database only).
 *   npm run db:demo:news         -> (re)create 3 tabs with sample links
 *   npm run db:demo:news:clear   -> remove them again
 * Everything it creates has an id starting with "demo_news"; it refuses to run against a database that is not on this computer.
 * The links are the front pages of real public sites (with a ?demo=N tail so each one is a different link); no feed is added,
 * because a feed needs a live address: add one by hand at แอดมิน › ข่าวสาร.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(url)) {
  console.error("Refusing to run: DATABASE_URL is not a local database. The sample news are for local development only.");
  process.exit(1);
}

const db = new PrismaClient();

type Sample = { title: string; site: string; note?: string; daysAgo: number; pinned?: boolean };
const TABS: { name: string; pageSize: number; items: Sample[] }[] = [
  {
    name: "ข่าวประชาสัมพันธ์",
    pageSize: 6,
    items: [
      { title: "(ตัวอย่าง) สพฐ. เปิดรับฟังความคิดเห็นหลักสูตรสถานศึกษา ฉบับปรับปรุง", site: "https://www.obec.go.th/", note: "ที่มา: สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน", daysAgo: 1, pinned: true },
      { title: "(ตัวอย่าง) ประกาศรายชื่อโรงเรียนต้นแบบการใช้สื่อดิจิทัลเพื่อการเรียนรู้ ประจำปีการศึกษา 2569", site: "https://contentcenter.obec.go.th/", daysAgo: 2 },
      { title: "(ตัวอย่าง) เชิญร่วมกิจกรรมเฉลิมฉลองวันภาษาไทยแห่งชาติ ระดับเขตพื้นที่การศึกษา", site: "https://www.moe.go.th/", note: "ที่มา: กระทรวงศึกษาธิการ", daysAgo: 4 },
      { title: "(ตัวอย่าง) แนวทางการประเมินคุณภาพภายนอกสำหรับสถานศึกษา รอบใหม่", site: "https://www.onesqa.or.th/", daysAgo: 6 },
      { title: "(ตัวอย่าง) เปิดให้ลงทะเบียนเรียนออนไลน์ฟรี หลักสูตรการจัดการเรียนรู้เชิงรุก", site: "https://thaimooc.org/", note: "เรียนได้ทุกที่ ทุกเวลา มีเกียรติบัตร", daysAgo: 8 },
      { title: "(ตัวอย่าง) สรุปผลการนิเทศติดตามการจัดการเรียนการสอน ภาคเรียนที่ 1", site: "https://www.obec.go.th/", daysAgo: 11 },
      { title: "(ตัวอย่าง) ปฏิทินการปฏิบัติงานของเขตพื้นที่การศึกษา ประจำเดือนตุลาคม", site: "https://www.moe.go.th/", daysAgo: 14 },
      { title: "(ตัวอย่าง) ขอเชิญชมการถ่ายทอดสดการอบรมครูผู้สอนวิชาวิทยาศาสตร์", site: "https://www.ipst.ac.th/", daysAgo: 19 },
      { title: "(ตัวอย่าง) ประกาศผลการคัดเลือกสื่อการเรียนรู้ดีเด่น ระดับเขตพื้นที่", site: "https://contentcenter.obec.go.th/", daysAgo: 25 },
    ],
  },
  {
    name: "นโยบายและประกาศ",
    pageSize: 6,
    items: [
      { title: "(ตัวอย่าง) นโยบายการจัดการศึกษาของกระทรวงศึกษาธิการ ปีงบประมาณ 2569", site: "https://www.moe.go.th/", note: "ที่มา: กระทรวงศึกษาธิการ", daysAgo: 3, pinned: true },
      { title: "(ตัวอย่าง) ประกาศ ก.ค.ศ. เรื่อง หลักเกณฑ์และวิธีการประเมินตำแหน่งและวิทยฐานะ", site: "https://www.otepc.go.th/", daysAgo: 5 },
      { title: "(ตัวอย่าง) แนวปฏิบัติการคุ้มครองข้อมูลส่วนบุคคลของนักเรียนในสถานศึกษา (PDPA)", site: "https://www.pdpc.or.th/", note: "ที่มา: สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล", daysAgo: 9 },
      { title: "(ตัวอย่าง) หนังสือสั่งการ เรื่อง การเตรียมความพร้อมรับสถานการณ์อุทกภัยในสถานศึกษา", site: "https://www.obec.go.th/", daysAgo: 12 },
      { title: "(ตัวอย่าง) มาตรฐานการศึกษาของชาติ และแนวทางการนำไปใช้ในสถานศึกษา", site: "https://www.onec.go.th/", daysAgo: 17 },
      { title: "(ตัวอย่าง) ระเบียบสำนักนายกรัฐมนตรีว่าด้วยการรักษาความปลอดภัยของสถานศึกษา", site: "https://www.moe.go.th/", daysAgo: 23 },
      { title: "(ตัวอย่าง) นโยบายเรียนดี มีความสุข: แนวทางลดภาระงานที่ไม่จำเป็นของครู", site: "https://www.obec.go.th/", daysAgo: 30 },
    ],
  },
  {
    name: "กิจกรรมและอบรม",
    pageSize: 4,
    items: [
      { title: "(ตัวอย่าง) อบรมเชิงปฏิบัติการ: สร้างสื่อการสอนด้วยปัญญาประดิษฐ์สำหรับครู", site: "https://www.ksp.or.th/", note: "สมัครได้จนถึงสิ้นเดือน", daysAgo: 2, pinned: true },
      { title: "(ตัวอย่าง) ประชุมวิชาการศึกษานิเทศก์ระดับประเทศ ครั้งที่ 12", site: "https://www.moe.go.th/", daysAgo: 7 },
      { title: "(ตัวอย่าง) ค่ายวิทยาศาสตร์ภาคฤดูหนาวสำหรับนักเรียนระดับประถมศึกษา", site: "https://www.ipst.ac.th/", daysAgo: 13 },
      { title: "(ตัวอย่าง) การแข่งขันงานศิลปหัตถกรรมนักเรียน ระดับเขตพื้นที่การศึกษา", site: "https://www.obec.go.th/", note: "ประกาศกำหนดการและสถานที่จัดแข่งขัน", daysAgo: 21 },
      { title: "(ตัวอย่าง) เวทีแลกเปลี่ยนเรียนรู้ (PLC) เครือข่ายศูนย์พัฒนาคุณภาพการศึกษา", site: "https://www.obec.go.th/", daysAgo: 28 },
    ],
  },
];

async function main() {
  await db.newsTab.deleteMany({ where: { id: { startsWith: "demo_newstab_" } } }); // their items go with them
  if (process.argv.includes("--clear")) {
    console.log("Removed the sample news tabs.");
    return;
  }
  const last = await db.newsTab.aggregate({ _max: { sortOrder: true } });
  const start = (last._max.sortOrder ?? 0) + 1;
  const now = Date.now();
  let n = 0;
  for (const [t, tab] of TABS.entries()) {
    await db.newsTab.create({ data: { id: `demo_newstab_${t + 1}`, name: tab.name, pageSize: tab.pageSize, sortOrder: start + t } });
    for (const it of tab.items) {
      n++;
      await db.newsItem.create({
        data: {
          id: `demo_news_${n}`,
          tabId: `demo_newstab_${t + 1}`,
          kind: "LINK",
          title: it.title,
          url: `${it.site}?demo=${n}`,
          note: it.note ?? null,
          publishedAt: new Date(now - it.daysAgo * 24 * 60 * 60 * 1000),
          pinned: !!it.pinned,
        },
      });
    }
  }
  console.log(`Created ${TABS.length} tabs with ${n} sample links.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
