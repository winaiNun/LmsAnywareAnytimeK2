/**
 * Sample media so the library can be seen with real-looking content (LOCAL database only).
 *   npm run db:demo:media         -> (re)create 10 published sample media + 1 waiting for review
 *   npm run db:demo:media:clear   -> remove them again
 * Everything it creates has an id starting with "demo_" so real data is never touched, and it refuses to run
 * against any database that is not on this computer.
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { ICON_PATHS } from "../src/lib/icon-paths";
import { getStorage } from "../src/lib/storage";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(url)) {
  console.error("Refusing to run: DATABASE_URL is not a local database. The sample media are for local development only.");
  process.exit(1);
}

const db = new PrismaClient();
const FONT = "Leelawadee UI, Tahoma, Sarabun, sans-serif";
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const colors: Record<string, [string, string]> = {
  math: ["#2563EB", "#1E3A8A"], thai: ["#E11D48", "#881337"], science: ["#059669", "#064E3B"], social: ["#D97706", "#78350F"],
  health: ["#DC2626", "#7F1D1D"], art: ["#9333EA", "#4C1D95"], career: ["#0891B2", "#164E63"], foreign: ["#4F46E5", "#312E81"],
  activity: ["#EA580C", "#7C2D12"], "teacher-tech": ["#475569", "#0F172A"],
};

// ---- three small interactive apps (pasted-HTML media). Each is one self-contained page.
const style = `<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Tahoma,sans-serif;margin:0;padding:16px;background:#f5f8ff;color:#1b2559;text-align:center}h1{font-size:20px;margin:6px 0 12px}button{font:inherit;cursor:pointer}.b{display:inline-block;min-width:64px;margin:6px;padding:14px 18px;border:0;border-radius:14px;background:#0052ff;color:#fff;font-size:22px;box-shadow:0 3px 0 #003bb3}.b:active{transform:translateY(2px);box-shadow:none}.ok{background:#17b26a;box-shadow:0 3px 0 #0e7a49}.no{background:#f04438;box-shadow:0 3px 0 #b42318}.q{font-size:34px;margin:14px 0}.s{margin-top:10px;color:#475569}</style>`;
const ADD_GAME = `<!doctype html><html lang="th"><head><meta charset="utf-8">${style}</head><body><h1>เกมฝึกบวกเลข ป.1</h1><div class="q" id="q"></div><div id="o"></div><p class="s">คะแนน <b id="sc">0</b> / <span id="n">0</span> <span id="m"></span></p><script>
let sc=0,n=0,ans=0;function nx(){const a=1+Math.floor(Math.random()*9),b=1+Math.floor(Math.random()*(10-a));ans=a+b;document.getElementById('q').textContent=a+' + '+b+' = ?';const set=new Set([ans]);while(set.size<4)set.add(Math.max(0,ans+Math.floor(Math.random()*7)-3));const o=document.getElementById('o');o.innerHTML='';[...set].sort(()=>Math.random()-.5).forEach(v=>{const x=document.createElement('button');x.className='b';x.textContent=v;x.onclick=()=>{n++;if(v===ans){sc++;x.className='b ok';document.getElementById('m').textContent='✓ เก่งมาก!'}else{x.className='b no';document.getElementById('m').textContent='ลองใหม่นะ คำตอบคือ '+ans}document.getElementById('sc').textContent=sc;document.getElementById('n').textContent=n;setTimeout(nx,900)};o.appendChild(x)})}nx();</script></body></html>`;
const SPELL_QUIZ = `<!doctype html><html lang="th"><head><meta charset="utf-8">${style}</head><body><h1>แบบทดสอบการสะกดคำ</h1><div class="q" id="q"></div><div id="o"></div><p class="s" id="m">เลือกคำที่สะกดถูกต้อง</p><script>
const Q=[['อนุญาต','อนุยาต','อนุญาติ'],['สวัสดี','สวัสดิ์','สวัสดี๋'],['กะทิ','กระทิ','กะทิ์'],['ประเทศ','ประเทส','ประเทศน์'],['ผลไม้','ผลไม','ผลไม๊']];let i=0,s=0;
function show(){if(i>=Q.length){document.getElementById('q').textContent='ได้ '+s+' / '+Q.length;document.getElementById('o').innerHTML='<button class="b" onclick="i=0;s=0;show()">เล่นอีกครั้ง</button>';document.getElementById('m').textContent='';return}
const c=Q[i][0];document.getElementById('q').textContent='ข้อ '+(i+1)+'/'+Q.length;const o=document.getElementById('o');o.innerHTML='';[...Q[i]].sort(()=>Math.random()-.5).forEach(w=>{const b=document.createElement('button');b.className='b';b.textContent=w;b.onclick=()=>{if(w===c){s++;b.className='b ok';document.getElementById('m').textContent='ถูกต้อง!'}else{b.className='b no';document.getElementById('m').textContent='ที่ถูกคือ “'+c+'”'}i++;setTimeout(show,900)};o.appendChild(b)})}show();</script></body></html>`;
const ELEMENTS = "H ไฮโดรเจน 1.008;He ฮีเลียม 4.003;Li ลิเทียม 6.94;Be เบริลเลียม 9.012;B โบรอน 10.81;C คาร์บอน 12.01;N ไนโตรเจน 14.01;O ออกซิเจน 16.00;F ฟลูออรีน 19.00;Ne นีออน 20.18;Na โซเดียม 22.99;Mg แมกนีเซียม 24.31;Al อะลูมิเนียม 26.98;Si ซิลิคอน 28.09;P ฟอสฟอรัส 30.97;S กำมะถัน 32.06;Cl คลอรีน 35.45;Ar อาร์กอน 39.95;K โพแทสเซียม 39.10;Ca แคลเซียม 40.08";
const PERIODIC = `<!doctype html><html lang="th"><head><meta charset="utf-8">${style}<style>.g{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;max-width:420px;margin:0 auto}.e{padding:10px 2px;border:0;border-radius:10px;background:#fff;box-shadow:0 1px 3px #0002}.e b{display:block;font-size:20px;color:#0052ff}.e i{font-size:10px;color:#64748b;font-style:normal}#d{margin:12px auto;max-width:420px;padding:12px;border-radius:12px;background:#0b2a6f;color:#fff;min-height:48px}</style></head><body><h1>ตารางธาตุอย่างง่าย (20 ธาตุแรก)</h1><div class="g" id="g"></div><div id="d">แตะธาตุเพื่อดูรายละเอียด</div><script>
const E="${ELEMENTS}".split(';').map((t,i)=>{const [s,n,m]=t.split(' ');return{s,n,m,z:i+1}});const g=document.getElementById('g');E.forEach(e=>{const b=document.createElement('button');b.className='e';b.innerHTML='<i>'+e.z+'</i><b>'+e.s+'</b><i>'+e.n+'</i>';b.onclick=()=>{document.getElementById('d').innerHTML='<b>'+e.n+' ('+e.s+')</b><br>เลขอะตอม '+e.z+' · มวลอะตอม '+e.m};g.appendChild(b)});</script></body></html>`;

type Def = { id: string; title: string; areaSlug: string; typeSlug: string; levels: string[]; owner: number; days: number; views: number; likes: number; cover: boolean; tags: string[]; description: string; status?: "PUBLISHED" | "PENDING"; item: { kind: "LINK"; url: string } | { kind: "HTML"; html: string } };
const DRIVE = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view";
const DEFS: Def[] = [
  { id: "demo_media_1", title: "เกมฝึกบวกเลข ป.1", areaSlug: "math", typeSlug: "game", levels: ["primary"], owner: 0, days: 3, views: 420, likes: 28, cover: true, tags: ["การบวก", "เกม", "ป.1"], description: "เกมบวกเลขไม่เกิน 10 เลือกคำตอบจาก 4 ตัวเลือก มีคะแนนและคำชมให้กำลังใจ เล่นได้บนมือถือ ไม่ต้องติดตั้งอะไร", item: { kind: "HTML", html: ADD_GAME } },
  { id: "demo_media_2", title: "แบบทดสอบการสะกดคำภาษาไทย", areaSlug: "thai", typeSlug: "quiz", levels: ["primary", "lower-secondary"], owner: 2, days: 6, views: 260, likes: 17, cover: false, tags: ["สะกดคำ", "แบบทดสอบ"], description: "ทดสอบการสะกดคำที่มักเขียนผิด 5 ข้อ เฉลยทันทีหลังตอบ เล่นซ้ำได้", item: { kind: "HTML", html: SPELL_QUIZ } },
  { id: "demo_media_3", title: "ตารางธาตุอย่างง่าย (20 ธาตุแรก)", areaSlug: "science", typeSlug: "app", levels: ["lower-secondary"], owner: 1, days: 10, views: 610, likes: 41, cover: true, tags: ["ตารางธาตุ", "เคมี"], description: "แตะธาตุเพื่อดูชื่อ เลขอะตอม และมวลอะตอม เหมาะใช้ประกอบการสอนเรื่องธาตุและสารประกอบ", item: { kind: "HTML", html: PERIODIC } },
  { id: "demo_media_4", title: "[ตัวอย่าง] วิดีโอ YouTube — เล่าเรื่องการเรียนรู้", areaSlug: "social", typeSlug: "video", levels: ["lower-secondary"], owner: 0, days: 15, views: 90, likes: 6, cover: false, tags: ["วิดีโอ"], description: "ตัวอย่างการฝังวิดีโอ YouTube ในหน้าสื่อ (วิดีโอตัวอย่างจากผู้อื่น ใช้เพื่อสาธิตการแสดงผลเท่านั้น)", item: { kind: "LINK", url: "https://www.youtube.com/watch?v=iG9CE55wbtY" } },
  { id: "demo_media_5", title: "[ตัวอย่าง] การศึกษากับความคิดสร้างสรรค์ (YouTube)", areaSlug: "teacher-tech", typeSlug: "video", levels: [], owner: 1, days: 20, views: 300, likes: 22, cover: true, tags: ["ครู", "แรงบันดาลใจ"], description: "ตัวอย่างสื่อสำหรับครู ใช้ลิงก์ YouTube สาธารณะ เพื่อสาธิตการแสดงผลและการนับยอดดู", item: { kind: "LINK", url: "https://youtu.be/iG9CE55wbtY?t=30" } },
  { id: "demo_media_6", title: "[ตัวอย่าง] วิดีโอกิจกรรมพัฒนาผู้เรียน", areaSlug: "activity", typeSlug: "video", levels: ["primary"], owner: 3, days: 25, views: 480, likes: 33, cover: false, tags: ["กิจกรรม"], description: "ตัวอย่างการวางลิงก์ YouTube รูปแบบสั้น (youtu.be) ระบบแปลงเป็นตัวเล่นให้อัตโนมัติ", item: { kind: "LINK", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" } },
  { id: "demo_media_7", title: "[ตัวอย่างลิงก์ Drive] ใบความรู้การออกกำลังกาย", areaSlug: "health", typeSlug: "document", levels: ["primary"], owner: 2, days: 30, views: 150, likes: 9, cover: false, tags: ["สุขภาพ", "PDF"], description: "ตัวอย่างโครงสร้างสื่อที่ใช้ไฟล์จาก Google Drive (ลิงก์ในตัวอย่างนี้ไม่ใช่ไฟล์จริง จึงเปิดไม่ได้ ใส่ลิงก์ไฟล์ที่แชร์เป็น “ทุกคนที่มีลิงก์” ของคุณแทน)", item: { kind: "LINK", url: DRIVE } },
  { id: "demo_media_8", title: "[ตัวอย่างลิงก์ Google Docs] แผนการสอนศิลปะ", areaSlug: "art", typeSlug: "lesson-plan", levels: ["primary", "lower-secondary"], owner: 0, days: 35, views: 70, likes: 4, cover: false, tags: ["แผนการสอน"], description: "ตัวอย่างโครงสร้างสื่อที่ใช้ Google Docs (ลิงก์ตัวอย่างไม่ใช่เอกสารจริง)", item: { kind: "LINK", url: "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit?usp=sharing" } },
  { id: "demo_media_9", title: "ฝึกคำศัพท์ภาษาอังกฤษด้วย Kahoot", areaSlug: "foreign", typeSlug: "game", levels: ["primary"], owner: 4, days: 40, views: 420, likes: 25, cover: false, tags: ["อังกฤษ", "คำศัพท์"], description: "ตัวอย่างลิงก์ภายนอกที่เปิดในแท็บใหม่ (เว็บอย่าง Kahoot ไม่อนุญาตให้ฝังในหน้าอื่น)", item: { kind: "LINK", url: "https://kahoot.it/" } },
  { id: "demo_media_10", title: "[ตัวอย่างโครงสร้าง] เว็บแอป Google Apps Script", areaSlug: "career", typeSlug: "app", levels: ["lower-secondary"], owner: 1, days: 50, views: 350, likes: 19, cover: false, tags: ["Apps Script"], description: "ตัวอย่างโครงสร้างสื่อที่ใช้ Apps Script ที่ Deploy เป็นเว็บแอป (ลิงก์ในตัวอย่างไม่ใช่สคริปต์จริง)", item: { kind: "LINK", url: "https://script.google.com/macros/s/AKfycbxAbCdEfGhIjKlMnOpQrStUvWxYz0123456789/exec" } },
  { id: "demo_media_11", title: "สื่อรอตรวจ: เกมจับคู่คำศัพท์", areaSlug: "foreign", typeSlug: "game", levels: ["primary"], owner: 2, days: 1, views: 0, likes: 0, cover: false, tags: ["รออนุมัติ"], description: "ตัวอย่างสื่อที่ส่งขออนุมัติ — ผู้ตรวจจะเห็นในเมนู “ตรวจสื่อ”", status: "PENDING", item: { kind: "LINK", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" } },
];

const OWNERS = [
  { id: "demo_mu_1", name: "ครูสมศรี รักเรียน", first: "สมศรี", last: "รักเรียน", prefix: "นางสาว", type: "TEACHER" as const, avatar: "#2563EB", initial: "ส" },
  { id: "demo_mu_2", name: "ศน.ประสิทธิ์ นิเทศดี", first: "ประสิทธิ์", last: "นิเทศดี", prefix: "นาย", type: "SUPERVISOR" as const, avatar: "#059669", initial: "ป" },
  { id: "demo_mu_3", name: "ครูวิภา ใจดี", first: "วิภา", last: "ใจดี", prefix: "นาง", type: "TEACHER" as const, avatar: null, initial: "ว" },
  { id: "demo_mu_4", name: "คุณสมชาย ทองดี", first: "สมชาย", last: "ทองดี", prefix: "นาย", type: "GENERAL" as const, avatar: null, initial: "ส" },
  { id: "demo_mu_5", name: "เด็กชายธนา ตั้งใจเรียน", first: "ธนา", last: "ตั้งใจเรียน", prefix: "เด็กชาย", type: "STUDENT" as const, avatar: null, initial: "ธ" },
];

const posterSvg = (title: string, c1: string, c2: string, icon: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="1100" cy="130" r="260" fill="#fff" opacity=".10"/><circle cx="1180" cy="620" r="180" fill="#fff" opacity=".08"/><g transform="translate(86 150) scale(7.5)" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".92"><path d="${ICON_PATHS[icon] ?? ICON_PATHS["book-open"]}"/></g><text x="90" y="520" font-size="72" font-weight="700" fill="#fff" font-family="${FONT}">${title.replace(/&/g, "&amp;").slice(0, 26)}</text></svg>`;
const avatarSvg = (c: string, initial: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="${c}"/><text x="256" y="340" font-size="250" font-weight="700" fill="#fff" text-anchor="middle" font-family="${FONT}">${initial}</text></svg>`;
const toWebp = (svg: string, w: number, h: number) => sharp(Buffer.from(svg), { density: 96 }).resize(w, h).webp({ quality: 82 }).toBuffer();

async function clear() {
  const media = await db.media.findMany({ where: { id: { startsWith: "demo_media_" } }, select: { coverKey: true } });
  const owners = await db.user.findMany({ where: { id: { startsWith: "demo_mu_" } }, select: { avatarKey: true } });
  await db.media.deleteMany({ where: { id: { startsWith: "demo_media_" } } }); // items, likes, views go with it
  await db.user.deleteMany({ where: { id: { startsWith: "demo_mu_" } } });
  const storage = getStorage();
  for (const k of [...media.map((m) => m.coverKey), ...owners.map((o) => o.avatarKey)]) if (k) await storage.delete(k).catch(() => {});
}

async function main() {
  await clear();
  if (process.argv.includes("--clear")) { console.log("Demo media removed."); return; }

  const storage = getStorage();
  const area = new Map((await db.learningArea.findMany()).map((a) => [a.slug, a]));
  const type = new Map((await db.mediaType.findMany()).map((t) => [t.slug, t]));
  const level = new Map((await db.educationLevel.findMany()).map((l) => [l.slug, l]));
  const school = await db.school.findFirst({ orderBy: { code: "asc" }, select: { id: true } });
  const hash = await bcrypt.hash("Demo12345!", 8);

  // owners (with round profile pictures for some, a letter for the rest)
  for (const [i, o] of OWNERS.entries()) {
    let avatarKey: string | null = null;
    if (o.avatar) { avatarKey = `avatars/demo-${o.id}-${randomUUID().slice(0, 6)}.webp`; await storage.put(avatarKey, await toWebp(avatarSvg(o.avatar, o.initial), 512, 512), "image/webp"); }
    await db.user.create({ data: { id: o.id, username: `demo.owner${i + 1}`, name: o.name, prefix: o.prefix, firstName: o.first, lastName: o.last, memberType: o.type, passwordHash: hash, avatarKey, schoolId: o.type === "TEACHER" || o.type === "STUDENT" ? school?.id : null, organization: o.type === "SUPERVISOR" ? "สพป.ตัวอย่าง" : null } });
  }

  const likers = await db.user.findMany({ where: { id: { not: { startsWith: "demo_mu_" } }, active: true }, take: 60, select: { id: true } });
  for (const d of DEFS) {
    const a = area.get(d.areaSlug)!;
    const [c1, c2] = colors[d.areaSlug];
    let coverKey: string | null = null;
    if (d.cover) { coverKey = `media/cover-${d.id}-${randomUUID().slice(0, 6)}.webp`; await storage.put(coverKey, await toWebp(posterSvg(d.title.replace(/^\[.*?\]\s*/, ""), c1, c2, a.icon), 960, 540), "image/webp"); }
    const status = d.status ?? "PUBLISHED";
    const likeIds = likers.slice(0, d.likes).map((u) => u.id);
    await db.media.create({
      data: {
        id: d.id, title: d.title, description: d.description, areaId: a.id, typeId: type.get(d.typeSlug)!.id, tags: d.tags, coverKey,
        status, publishedAt: status === "PUBLISHED" ? daysAgo(d.days) : null, createdById: OWNERS[d.owner].id,
        viewCount: d.views, likeCount: likeIds.length, downloadCount: Math.round(d.views * 0.12),
        createdAt: daysAgo(d.days + 1),
        levels: { create: d.levels.map((l) => ({ levelId: level.get(l)!.id })) },
        items: { create: [d.item.kind === "HTML" ? { kind: "HTML" as const, html: d.item.html, sortOrder: 0 } : { kind: "YOUTUBE" as const, url: d.item.url, sortOrder: 0 }] },
      },
    });
    // the first item's kind is decided by the link parser in real life; fix it for the sample rows
    if (d.item.kind === "LINK") {
      const { parseMediaLink, isParsed } = await import("../src/lib/embed");
      const r = parseMediaLink(d.item.url);
      if (isParsed(r)) await db.mediaItem.updateMany({ where: { mediaId: d.id }, data: { kind: r.kind, url: r.url } });
    }
    if (likeIds.length) await db.mediaLike.createMany({ data: likeIds.map((userId) => ({ userId, mediaId: d.id })) });
    // daily buckets over the media's life (max 30 days) so "most viewed in 30 days" can differ from "newest"
    const span = Math.min(d.days, 30);
    if (span > 0 && d.views > 0) {
      const days = Array.from({ length: span }, (_, i) => ({ i, w: rnd() + 0.2 }));
      const total = days.reduce((n, x) => n + x.w, 0);
      const recentBoost = d.days > 30 ? 0.25 : 1; // old media were popular back then, quieter lately
      await db.mediaViewDaily.createMany({
        data: days.map((x) => {
          const day = daysAgo(x.i);
          return { mediaId: d.id, day: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())), views: Math.max(1, Math.round((d.views * recentBoost * x.w) / total)) };
        }),
      });
    }
  }
  console.log(`Demo media created: ${DEFS.filter((d) => d.status !== "PENDING").length} published + ${DEFS.filter((d) => d.status === "PENDING").length} waiting for review, ${OWNERS.length} sample owners.`);
  console.log("Sample owners sign in as demo.owner1 ... demo.owner5 (password Demo12345!).");
}

main().finally(() => db.$disconnect());
