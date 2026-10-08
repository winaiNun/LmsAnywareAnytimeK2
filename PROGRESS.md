# บันทึกความคืบหน้า — ระบบคลังสื่อการเรียนรู้ + LMS (Anyware Anytime)

อัปเดตล่าสุด: 8 ต.ค. 2026 · ไฟล์นี้เขียนไว้ให้เปิดอ่านแล้วทำต่อได้ทันที (ที่บ้าน/เครื่องอื่น)

## 1. เป้าหมายและแนวทางที่ตกลงกัน
- ระบบ **คลังสื่อการเรียนรู้ + LMS + ระบบสมาชิก** สำหรับเขตพื้นที่ มีแผนขยายให้เขตอื่นใช้ (ชื่อระบบ/ชื่อเขต/โลโก้ตั้งได้จากหลังบ้าน)
- **ไม่ผูกติดผู้ให้บริการ** ย้ายไป VPS ได้ง่าย เลือกเทคโนโลยีที่เสถียร ไม่ใหม่เกินไป
- ฟอนต์ **Sarabun** ทั้งระบบ · สีหลัก `#0052FF` (แนวเดียวกับ aipass.go.th) · UI ภาษาไทย
- คำเรียกในระบบ: ใช้ "**สื่อการเรียนรู้**" (ไม่ใช้ "หนังสือเข้าใหม่")

| ส่วน | เลือกใช้ |
|---|---|
| Framework | Next.js **14** (App Router) + TypeScript |
| DB / ORM | PostgreSQL 16 (Docker) + **Prisma 5** (migration อยู่ใน git) |
| Auth | NextAuth **v4** (อีเมล+รหัสผ่าน, JWT, บทบาท ADMIN/LIBRARIAN/TEACHER/STUDENT) |
| UI | Tailwind CSS 3 (ยังไม่ได้ติดตั้ง shadcn/ui) |
| รูปภาพ | `sharp` ย่อ/แปลงเป็น WebP ฝั่งเซิร์ฟเวอร์ + ครอบรูปในเบราว์เซอร์ (canvas) |
| ที่เก็บไฟล์ | `StorageProvider`: **local** (`./storage`) หรือ **s3** (R2 / Supabase Storage / S3 อื่นๆ) เลือกด้วย `STORAGE_DRIVER` |
| อีเมลตอนพัฒนา | Mailpit (Docker) — ยังไม่ได้ใช้ส่งอีเมลจริง |

## 2. วิธีรัน (เครื่องใหม่)
ต้องมี Node 20+ และ Docker

```bash
npm install
cp .env.example .env        # แล้วแก้ NEXTAUTH_SECRET เป็นค่าสุ่มของตัวเอง
npm run db:up               # Postgres (พอร์ต 5433) + Mailpit (เว็บ 8025)
npx prisma migrate dev      # สร้างตารางทั้งหมด
npm run db:seed             # สร้างแอดมิน (ตั้ง SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD ก่อนได้)
npm run db:demo             # (ไม่บังคับ) ข้อมูลตัวอย่างให้หน้าเว็บมีของแสดง
npm run dev                 # http://localhost:3000
```

- ค่าเริ่มต้นแอดมิน: `admin@example.com` / `ChangeMe123!` → **เปลี่ยนก่อนใช้งานจริงเสมอ**
- สมาชิกเดโม่: `member1@demo.local` … รหัส `Demo12345!`
- ลบข้อมูลเดโม่: `npm run db:demo:clear` (ไม่แตะข้อมูลจริง ข้อมูลเดโม่ทุกแถวมี id ขึ้นต้น `demo_`)
- **ไฟล์ที่ไม่อยู่ใน git:** `.env` และโฟลเดอร์ `storage/` (รูป/วิดีโอที่อัปโหลด) — ถ้าย้ายเครื่องต้องสร้าง `.env` ใหม่และรัน `db:demo` หรืออัปโหลดใหม่
- **ยังไม่ได้ commit งานช่วงหลัง** (git มีแค่ commit แรกของ create-next-app) → ก่อนย้ายเครื่องแนะนำ `git add -A && git commit` แล้ว push ขึ้น GitHub (ห้าม commit `.env`)

## 3. สิ่งที่ทำเสร็จแล้ว
**หน้าเว็บสาธารณะ**
- `/` หน้าแรก: navbar เต็มความกว้างตรึงบน (โลโก้+ชื่อระบบจากหลังบ้าน) → **แบนเนอร์ชื่อระบบ** (โลโก้พื้นโปร่งใสได้, ชื่อระบบ, ชื่อเขต, วิดีโอพื้นหลังเฟดเข้า/ออกตอนวนรอบ, ไม่มีวิดีโอจะเป็นแสงเคลื่อนช้าๆ) → เซกชันต่างๆ ตามลำดับที่ตั้ง
- `/login` หน้าล็อกอิน/สมัครสมาชิก สไตล์พื้นน้ำเงินเรืองแสง มี "จดจำฉัน 30 วัน", ปุ่มกลับหน้าหลัก, ส่งแอดมินไป `/admin` ส่วนสมาชิกไป `/dashboard`
- `/dashboard` หน้าสมาชิก — **ยังเป็นหน้าชั่วคราว** (ชื่อ+ปุ่มออกจากระบบ)

**หลังบ้าน `/admin`** (เฉพาะ ADMIN/LIBRARIAN) — สไตล์แดชบอร์ด: แถบซ้าย + แถบบนเทาเข้ม + การ์ดสี
- แดชบอร์ด: การ์ดตัวเลข 4 ใบ, กราฟแท่งสมาชิกใหม่ 6 เดือน, กราฟวงกลมสถานะการยืม, การยืมล่าสุด, คอร์สยอดนิยม
- **ตั้งค่าเขตพื้นที่** (`/admin/settings`): ชื่อระบบ/เขต/ข้อความรอง, โลโก้, วิดีโอพื้นหลัง (MP4/WebM ≤30MB), สีพื้น, ความมืดทับวิดีโอ, เวลาเฟด, ตัวเลือกวางโลโก้บนแผ่นขาว
- **เซกชันหน้าแรก** (`/admin/sections`): สลับลำดับ ↑↓, ข้อความกำกับ, ตำแหน่งซ้าย/กลาง/ขวา, ขนาดตัวอักษร, สีข้อความ, **พื้นหลัง: ไม่มี / สีเดียว / ไล่สี 2 สี (8 ทิศ) / ภาพ** (พร้อมความมืดทับ), ซ่อน/แสดง, **ปุ่มย่อ-ขยาย** แต่ละเซกชันและทั้งหมด
- **สไลด์แนะนำ** (`/admin/banners`): เพิ่ม/แก้/ลบ/เปิด-ปิด/เรียงลำดับ/ตั้งเวลาเริ่ม-สิ้นสุด, ครอบรูป 3:1 ใน modal แล้วย่อเป็น WebP ≤1800px
- **ตารางอ่านอย่างเดียว:** `/admin/users`, `/admin/books`, `/admin/courses`
- **modal ครอบรูป** ใช้ซ้ำได้ที่ [src/components/admin/crop-image-field.tsx](src/components/admin/crop-image-field.tsx) · พาเลตสี [src/components/admin/color-picker.tsx](src/components/admin/color-picker.tsx)

**ฐานข้อมูล (Prisma)**: User, Author, Category, Book, BookAuthor, BookFile, BookCopy, Loan, Course, Lesson, Enrollment, Banner, SiteSetting, HomeSection

## 4. แผนผังโค้ดที่ควรรู้
```
prisma/schema.prisma        โครงสร้างข้อมูล + migrations/
prisma/seed.ts              สร้างแอดมิน     prisma/demo.ts   ข้อมูลตัวอย่าง
src/lib/auth.ts             ตั้งค่า NextAuth (JWT, remember-me)
src/lib/storage/            StorageProvider: index.ts, local.ts, s3.ts (R2/S3, publicUrl, presignUpload)
scripts/migrate-local-to-s3.ts  ย้ายไฟล์ในเครื่องขึ้น bucket (npm run storage:migrate)
src/lib/image.ts            ย่อ/ครอบรูปด้วย sharp
src/lib/site.ts             ข้อมูลชื่อระบบ/โลโก้/วิดีโอ   src/lib/sections.ts  ตั้งค่าเซกชัน
src/lib/section-styles.ts   ค่าคงที่/ฟังก์ชันพื้นหลัง (ไม่แตะ DB ใช้ฝั่ง client ได้)
src/app/page.tsx            หน้าแรก    src/app/admin/…  หลังบ้าน (แต่ละหน้ามี actions.ts = server actions)
src/app/api/files/[...key]  เสิร์ฟไฟล์สาธารณะ (เฉพาะ banners/ และ site/, รองรับ Range)
src/components/             navbar, hero, carousel, admin shell/charts
```

## 5. ข้อควรระวัง / บทเรียน
- **พอร์ต DB = 5433** (เครื่องเดิมมี Postgres ของ Windows ใช้ 5432) — ตั้งไว้ใน `docker-compose.yml` และ `.env`
- **อย่ารัน `npm run dev` ซ้อนหลายตัว** (ใช้โฟลเดอร์ `.next` ร่วมกัน ทำให้หน้าค้างของเก่า) · รีสตาร์ทเซิร์ฟเวอร์หลังเปลี่ยน schema/migrate
- **server action รับไฟล์ได้ 35 MB** (`next.config.mjs` → `serverActions.bodySizeLimit`) — ค่าเริ่มต้นของ Next คือ 1 MB
- บน Windows/PowerShell 5.1: เขียนไฟล์ที่มีภาษาไทยด้วย `Set-Content` อาจเพี้ยน/มี BOM → ใช้เครื่องมือแก้ไฟล์ปกติแทน
- คอมเมนต์/ข้อความที่ส่งผ่าน shell ด้วย backtick ต้องระวัง — ตรวจ `npx tsc --noEmit` เสมอหลังแก้
- ทดสอบ UI จริงด้วย Chrome headless (puppeteer-core) ได้ — สคริปต์ทดสอบเก่าอยู่นอกโปรเจกต์ (scratchpad) ไม่ได้เก็บไว้

## 6. ⚠️ ก่อนขึ้น Vercel (ยังไม่พร้อม)
1. ~~ที่เก็บไฟล์ local ใช้ไม่ได้บน Vercel~~ → **ทำแล้ว (8 ต.ค.)**: มี provider `s3` ใน `src/lib/storage/s3.ts` ตั้ง `STORAGE_DRIVER=s3` + ค่า `S3_*` (ดู `.env.example`) · ถ้ามี `S3_PUBLIC_URL` เบราว์เซอร์จะโหลดไฟล์ตรงจาก bucket/CDN ไม่ผ่านเซิร์ฟเวอร์ · ทดสอบในเครื่อง: `docker compose --profile s3 up -d s3` (ใช้ Adobe S3Mock เพราะ image MinIO ถอดจาก Docker Hub แล้ว; ข้อมูลหายเมื่อลบ container) · ย้ายไฟล์เดิมขึ้น bucket: `npm run storage:migrate` · **ยังไม่ได้ทดสอบกับ Cloudflare R2/Supabase จริง** (bucket ต้องเปิด public-read เฉพาะ `banners/` และ `site/`)
2. ~~อัปโหลดวิดีโอ 30 MB เกินขีด 4.5 MB ของ Vercel~~ → **ทำแล้ว (8 ต.ค.)**: ถ้า driver เป็น s3 เบราว์เซอร์จะอัปโหลดวิดีโอตรงเข้า bucket ด้วย presigned URL (มีแถบ %, `src/app/admin/settings/video-field.tsx` + `requestVideoUpload` ใน `actions.ts`) แล้วส่งเฉพาะ key ตอนกดบันทึก · driver local ยังโพสต์ไฟล์ไปกับฟอร์มเหมือนเดิม · โลโก้ลดเพดานเหลือ 4 MB · **ต้องตั้ง CORS ของ bucket** (ดู DEPLOY.md) · ไฟล์ที่อัปโหลดแต่ไม่กดบันทึกจะค้างเป็นขยะใน bucket
3. ~~DB ต้องเป็นออนไลน์ + pooled~~ → **ทำแล้ว (8 ต.ค.)**: เพิ่ม `directUrl = env("DIRECT_URL")` ใน `schema.prisma` (ใน `.env` ในเครื่องตั้ง DIRECT_URL = DATABASE_URL), `postinstall: prisma generate`, `vercel-build` (generate + migrate deploy + next build) · `npm run build` ผ่านในเครื่อง · **ยังไม่ได้ deploy จริง** → ทำตาม **DEPLOY.md**
4. ตั้ง env บน Vercel: `DATABASE_URL`, `NEXTAUTH_URL` (โดเมนจริง), `NEXTAUTH_SECRET` (สุ่มใหม่), ค่าของที่เก็บไฟล์ · รัน seed กับ DB จริงและเปลี่ยนรหัสแอดมิน
- คู่มือ deploy ละเอียด: **DEPLOY.md**
- ไปต่อ VPS ภายหลัง: Docker Compose (app + postgres + minio + Caddy) — ตัวเก็บไฟล์แบบ S3 ที่ทำไว้ใช้ต่อได้ทันที

## 7. ขั้นต่อไปที่เสนอ (เรียงตามความสำคัญ)
1. **ขึ้น Vercel จริง** (ถ้าพร้อมสมัคร Supabase/Neon + Cloudflare R2): ตามคู่มือ **DEPLOY.md** — โค้ดพร้อมแล้ว (S3 provider, อัปโหลดวิดีโอตรง, directUrl/vercel-build) เหลือแค่ตั้งค่าบริการภายนอกและทดสอบจริง · ยังไม่จำเป็นต้องสมัครเพื่อพัฒนาต่อในเครื่อง
2. **ฟอร์มเพิ่ม/แก้สื่อการเรียนรู้** (อัปโหลดปก + ไฟล์ PDF/EPUB, ผู้แต่ง, หมวด) แทนตารางอ่านอย่างเดียว
3. ฟอร์มสร้าง/แก้คอร์ส + บทเรียน + หน้าเรียน + แบบทดสอบ
4. หน้า `/dashboard` ของสมาชิกจริง (ชั้นหนังสือของฉัน, คอร์สที่เรียน, ยืมอยู่/ครบกำหนด)
5. ระบบยืม-คืน/จอง, ค้นหา (pg_trgm), หน้ารายการ/รายละเอียดสื่อและคอร์สฝั่งสาธารณะ
6. ลืมรหัสผ่านทางอีเมล (Mailpit ตอนพัฒนา), จัดการสมาชิก/เปลี่ยนบทบาทในหลังบ้าน, audit log
7. เมนู navbar แก้จากหลังบ้านได้ · ช่องค้นหาบนแถบแอดมินยังเป็นแค่หน้าตา · เพิ่มชนิดเซกชันใหม่ (เช่น ข่าวประชาสัมพันธ์)
8. **Google Drive:** ตกลงให้ใช้แบบ "ลิงก์ไฟล์จาก Drive ฝังดู" (วางลิงก์ที่แชร์แบบทุกคนที่มีลิงก์ เก็บแค่รหัสไฟล์) ตอนทำฟอร์มเพิ่มสื่อการเรียนรู้ — ไม่ต้องใช้ Drive API · provider `gdrive` เต็มรูปแบบทำเมื่อจำเป็นจริงเท่านั้น (ติดโควต้า/Service Account/ขีดจำกัด Vercel)

## 8. ลิงก์/แหล่งอ้างอิง
- Mockup ที่ทำไว้ (ส่วนตัว): https://claude.ai/artifact/QxWceeCqbFKMgnyja15aQR
- แรงบันดาลใจหน้าตา: aipass.go.th (น้ำเงิน `#0052FF`, IBM Plex Sans Thai → เปลี่ยนเป็น Sarabun), เทมเพลต SkillSphere ของ Shadcn Studio (เฉพาะดูแนว ไม่ได้ซื้อ)
- แผนแรกเริ่ม: `C:\Users\Lenovo\.claude\plans\lms-lucky-sloth.md` (บนเครื่องนี้)
