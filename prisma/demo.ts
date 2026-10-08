/**
 * Demo data for showing the system before real content exists.
 *   npm run db:demo        -> (re)create demo data
 *   npm run db:demo:clear  -> remove it
 * Every demo row has an id starting with "demo_" so real data is never touched.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { getStorage } from "../src/lib/storage";

const db = new PrismaClient();
const FONT = "Leelawadee UI, Tahoma, Sarabun, sans-serif";

// deterministic pseudo-random so reruns look the same
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

async function clear() {
  await db.loan.deleteMany({ where: { OR: [{ id: { startsWith: "demo_" } }, { user: { id: { startsWith: "demo_" } } }] } });
  await db.enrollment.deleteMany({ where: { id: { startsWith: "demo_" } } });
  await db.lesson.deleteMany({ where: { id: { startsWith: "demo_" } } });
  await db.course.deleteMany({ where: { id: { startsWith: "demo_" } } });
  await db.bookCopy.deleteMany({ where: { id: { startsWith: "demo_" } } });
  await db.bookAuthor.deleteMany({ where: { bookId: { startsWith: "demo_" } } });
  await db.book.deleteMany({ where: { id: { startsWith: "demo_" } } });
  await db.author.deleteMany({ where: { id: { startsWith: "demo_" } } });
  await db.category.deleteMany({ where: { id: { startsWith: "demo_" } } });
  await db.banner.deleteMany({ where: { id: { startsWith: "demo_" } } });
  await db.user.deleteMany({ where: { id: { startsWith: "demo_" } } });
  await db.siteSetting.deleteMany({ where: { logoKey: { startsWith: "site/demo-" } } });
}

// Goes through the configured storage driver (local folder or S3/R2/MinIO).
const save = (key: string, data: Buffer) => getStorage().put(key, data, "image/webp");

const svgToWebp = (svg: string, w: number, h: number) =>
  sharp(Buffer.from(svg), { density: 96 }).resize(w, h).webp({ quality: 82 }).toBuffer();

function posterSvg(title: string, sub: string, c1: string, c2: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="1800" height="600" fill="url(#g)"/>
  <circle cx="1500" cy="120" r="260" fill="#fff" opacity=".10"/><circle cx="1680" cy="520" r="200" fill="#fff" opacity=".08"/>
  <rect x="1180" y="130" width="340" height="340" rx="36" fill="#fff" opacity=".16"/>
  <rect x="1230" y="180" width="240" height="30" rx="15" fill="#fff" opacity=".7"/><rect x="1230" y="240" width="170" height="30" rx="15" fill="#fff" opacity=".5"/>
  <rect x="1230" y="300" width="200" height="110" rx="18" fill="#fff" opacity=".35"/>
  <text x="100" y="270" font-size="92" font-weight="700" fill="#fff" font-family="${FONT}">${title}</text>
  <text x="100" y="360" font-size="44" fill="#fff" opacity=".92" font-family="${FONT}">${sub}</text></svg>`;
}

function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0052FF"/><stop offset="1" stop-color="#0B2A6F"/></linearGradient></defs>
  <circle cx="256" cy="256" r="236" fill="url(#g)"/>
  <path d="M130 150a24 24 0 0 1 24-24h170v230H154a24 24 0 0 0-24 24z" fill="#fff"/>
  <path d="M360 150h22v230H180" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>
  <path d="M175 190h110M175 235h80" stroke="#0052FF" stroke-width="16" stroke-linecap="round"/></svg>`;
}

async function main() {
  await clear();
  if (process.argv.includes("--clear")) {
    console.log("Demo data removed.");
    return;
  }

  // ---- site identity + banners (images) ----
  const logoKey = `site/demo-logo-${randomUUID()}.webp`;
  await save(logoKey, await svgToWebp(logoSvg(), 512, 512));
  // Never overwrite settings an admin has already saved.
  if (!(await db.siteSetting.findUnique({ where: { id: "main" } }))) {
    await db.siteSetting.create({
      data: {
        id: "main",
        systemName: "ศูนย์การเรียนรู้ดิจิทัล",
        areaName: "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาตัวอย่าง เขต 1",
        tagline: "ห้องสมุดและระบบเรียนรู้ออนไลน์ เรียนได้ทุกที่ ทุกเวลา",
        logoKey,
        overlayOpacity: 35,
        fadeSeconds: 1.5,
      },
    });
  }

  const posters = [
    ["คอร์ส: ทักษะดิจิทัลสำหรับครู", "เรียนฟรี 12 บทเรียน พร้อมวุฒิบัตร", "#0052FF", "#4F8BFF", "/#courses", "ดูคอร์ส"],
    ["หนังสือใหม่ ประจำเดือนนี้", "สื่อการเรียนรู้ e-book กว่า 20 รายการ", "#0F766E", "#34B3A5", "/#media", "ดูสื่อ"],
    ["อบรมออนไลน์ การวัดและประเมินผล", "สมัครได้ถึงสิ้นเดือนนี้", "#6D28D9", "#A78BFA", "/#courses", "สมัครเลย"],
  ];
  for (const [i, [title, sub, c1, c2, link, btn]] of posters.entries()) {
    const key = `banners/demo-${i + 1}.webp`;
    await save(key, await svgToWebp(posterSvg(title, sub, c1, c2), 1800, 600));
    await db.banner.create({
      data: { id: `demo_banner_${i + 1}`, title, subtitle: sub, imageKey: key, linkUrl: link, buttonText: btn, showText: false, sortOrder: i, bgColor: c1 },
    });
  }

  // ---- members ----
  const hash = await bcrypt.hash("Demo12345!", 8);
  const first = ["สมชาย", "สมหญิง", "วิชัย", "นภา", "ประเสริฐ", "ลลิตา", "ธนากร", "กัญญา", "อนุชา", "พิมพ์ชนก", "ศุภชัย", "รัตนา"];
  const last = ["ใจดี", "รักเรียน", "มั่นคง", "สุขสันต์", "เจริญผล", "แก้วมณี", "ทองดี", "บุญมา"];
  const users = Array.from({ length: 48 }, (_, i) => {
    const staff = i < 2;
    return {
      id: `demo_user_${i + 1}`,
      email: `member${i + 1}@demo.local`,
      name: `${pick(first)} ${pick(last)}`,
      passwordHash: hash,
      role: (i === 0 ? "TEACHER" : i === 1 ? "LIBRARIAN" : "STUDENT") as "TEACHER" | "LIBRARIAN" | "STUDENT",
      active: staff || rnd() > 0.06,
      createdAt: daysAgo(Math.floor(rnd() * rnd() * 175)), // more recent sign-ups
    };
  });
  await db.user.createMany({ data: users });

  // ---- library ----
  const cats = ["นิยาย", "วิทยาศาสตร์", "ประวัติศาสตร์", "ธุรกิจ", "ภาษา"].map((name, i) => ({ id: `demo_cat_${i + 1}`, name: `${name} (ตัวอย่าง)` }));
  await db.category.createMany({ data: cats });
  const authors = ["ก. ตัวอย่าง", "ข. ตัวอย่าง", "ค. ตัวอย่าง", "ง. ตัวอย่าง", "จ. ตัวอย่าง", "ฉ. ตัวอย่าง"].map((name, i) => ({ id: `demo_author_${i + 1}`, name }));
  await db.author.createMany({ data: authors });

  const titles = ["ประวัติศาสตร์ไทยสมัยใหม่", "พื้นฐานวิทยาศาสตร์ข้อมูล", "เรื่องสั้นแห่งฤดูฝน", "การบริหารโครงการยุคใหม่", "ภาษาอังกฤษเพื่ออาชีพ", "ชีวิตและธรรมชาติ", "การเงินส่วนบุคคล", "บทกวีใต้แสงจันทร์", "เทคนิคการสอนสมัยใหม่", "คณิตศาสตร์รอบตัว", "ดาราศาสตร์สำหรับเยาวชน", "ศิลปะการนำเสนอ"];
  const books = Array.from({ length: 24 }, (_, i) => ({
    id: `demo_book_${i + 1}`,
    title: `${titles[i % titles.length]}${i >= titles.length ? " เล่ม 2" : ""}`,
    isbn: `DEMO-${String(i + 1).padStart(4, "0")}`,
    description: "ข้อมูลตัวอย่างสำหรับแสดงผล",
    categoryId: pick(cats).id,
    createdAt: daysAgo(Math.floor(rnd() * 120)),
  }));
  await db.book.createMany({ data: books });
  await db.bookAuthor.createMany({ data: books.map((b) => ({ bookId: b.id, authorId: pick(authors).id })) });

  const copies = books.flatMap((b, i) =>
    Array.from({ length: 1 + Math.floor(rnd() * 3) }, (_, j) => ({ id: `demo_copy_${i + 1}_${j + 1}`, bookId: b.id, barcode: `DEMO-${i + 1}-${j + 1}` })),
  );
  await db.bookCopy.createMany({ data: copies });

  // loans: returned (past), active, overdue
  const students = users.filter((u) => u.role === "STUDENT");
  const loans = copies.slice(0, 40).map((c, i) => {
    const borrowed = daysAgo(1 + Math.floor(rnd() * 150));
    const due = new Date(borrowed.getTime() + 14 * 86400000);
    const state = i < 14 ? "active" : i < 20 ? "overdue" : "returned";
    const borrowedAt = state === "overdue" ? daysAgo(20 + Math.floor(rnd() * 20)) : state === "active" ? daysAgo(Math.floor(rnd() * 12)) : borrowed;
    const dueAt = new Date(borrowedAt.getTime() + 14 * 86400000);
    return {
      id: `demo_loan_${i + 1}`,
      copyId: c.id,
      userId: pick(students).id,
      borrowedAt,
      dueAt: state === "returned" ? due : dueAt,
      returnedAt: state === "returned" ? new Date(Math.min(Date.now(), due.getTime() - Math.floor(rnd() * 6) * 86400000)) : null,
    };
  });
  // one active loan per copy is enough for a demo
  await db.loan.createMany({ data: loans });

  // ---- LMS ----
  const courseDefs = [
    ["ทักษะดิจิทัลสำหรับครู", 12], ["การวัดและประเมินผลการเรียนรู้", 8], ["พื้นฐานการวิเคราะห์ข้อมูล", 12],
    ["การออกแบบสื่อการสอน", 10], ["ภาษาอังกฤษเพื่อการสื่อสาร", 16], ["ความปลอดภัยบนโลกออนไลน์", 6],
  ] as const;
  await db.course.createMany({
    data: courseDefs.map(([title], i) => ({ id: `demo_course_${i + 1}`, title, description: "คอร์สตัวอย่างสำหรับแสดงผล", published: i !== 5, createdAt: daysAgo(30 + i * 20) })),
  });
  await db.lesson.createMany({
    data: courseDefs.flatMap(([, n], i) =>
      Array.from({ length: n }, (_, j) => ({ id: `demo_lesson_${i + 1}_${j + 1}`, courseId: `demo_course_${i + 1}`, title: `บทที่ ${j + 1}`, position: j + 1 })),
    ),
  });
  const enrollments: { id: string; userId: string; courseId: string; progress: number; createdAt: Date }[] = [];
  for (const [i, u] of students.entries()) {
    for (const ci of new Set([Math.floor(rnd() * 5), Math.floor(rnd() * 5)])) {
      enrollments.push({ id: `demo_enr_${i}_${ci}`, userId: u.id, courseId: `demo_course_${ci + 1}`, progress: Math.floor(rnd() * 11) * 10, createdAt: daysAgo(Math.floor(rnd() * 90)) });
    }
  }
  await db.enrollment.createMany({ data: enrollments });

  console.log(`Demo data created: ${users.length} users, ${books.length} books, ${loans.length} loans, ${courseDefs.length} courses, ${enrollments.length} enrollments.`);
  console.log("Demo members: member1@demo.local ... (password Demo12345!)");
}

main().finally(() => db.$disconnect());
