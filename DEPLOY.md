# คู่มือขึ้น Vercel (Vercel + Supabase/Neon + Cloudflare R2)

ทดสอบแล้วในเครื่อง: `npm run build` ผ่าน, ตัวเก็บไฟล์ S3 (อัปโหลดสไลด์/วิดีโอตรงเข้า bucket) ทำงานกับตัวจำลอง S3 — **ยังไม่เคย deploy จริง** ทำตามลำดับด้านล่างและแก้ตามที่เจอ

## ภาพรวม
| ส่วน | ที่ใช้ | หมายเหตุ |
|---|---|---|
| แอป | Vercel | `vercel-build` รัน `prisma generate` + `migrate deploy` + `next build` |
| ฐานข้อมูล | Supabase หรือ Neon (Postgres) | ใช้เป็น Postgres เฉยๆ ย้ายออกได้ทุกเมื่อ |
| ไฟล์ | Cloudflare R2 | ฟรี 10 GB ไม่มีค่าดึงข้อมูลออก |

## 1) ฐานข้อมูล
1. สร้างโปรเจกต์ Postgres (Supabase: Project → Database → Connection string)
2. เก็บ 2 ลิงก์:
   - `DATABASE_URL` = ลิงก์แบบ **pooled** (Supabase: Transaction pooler พอร์ต 6543) ต่อท้ายด้วย `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL` = ลิงก์ตรง **ไม่ผ่าน pool** (พอร์ต 5432) ใช้ตอนรัน migration
   - Neon: `DATABASE_URL` = ลิงก์ที่มี `-pooler` ในชื่อโฮสต์, `DIRECT_URL` = ลิงก์ปกติ

## 2) ที่เก็บไฟล์ (Cloudflare R2)
1. R2 → Create bucket (เช่น `lms-files`)
2. **เปิดให้อ่านสาธารณะ** (Settings → Public access → ใช้โดเมน `r2.dev` หรือโดเมนของตัวเอง) แล้วจดค่า Public URL → `S3_PUBLIC_URL`
   - ไฟล์ที่เปิดสาธารณะมีเฉพาะโฟลเดอร์ `banners/` และ `site/` (โลโก้ สไลด์ วิดีโอพื้นหลัง) — **ห้ามเก็บไฟล์เฉพาะสมาชิกใน bucket นี้** (ต่อไปควรใช้ bucket แยกที่ไม่เปิดสาธารณะ)
3. **ตั้ง CORS** ของ bucket (จำเป็น ไม่งั้นอัปโหลดวิดีโอจากเบราว์เซอร์ไม่ได้):
   ```json
   [
     {
       "AllowedOrigins": ["https://<โดเมนของคุณ>", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["Content-Type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. R2 → Manage API tokens → สร้าง token สิทธิ์ Object Read & Write เฉพาะ bucket นี้ → ได้ Access Key ID / Secret

## 3) ตัวแปรสภาพแวดล้อมบน Vercel (Project → Settings → Environment Variables)
| ชื่อ | ค่า |
|---|---|
| `DATABASE_URL` | ลิงก์ pooled (ข้อ 1) |
| `DIRECT_URL` | ลิงก์ตรง (ข้อ 1) |
| `NEXTAUTH_URL` | `https://<โดเมนของคุณ>` |
| `NEXTAUTH_SECRET` | สุ่มใหม่: `openssl rand -base64 32` (ห้ามใช้ค่าในเครื่อง) |
| `STORAGE_DRIVER` | `s3` |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | ชื่อ bucket |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | จาก token ข้อ 2 |
| `S3_FORCE_PATH_STYLE` | `true` |
| `S3_PUBLIC_URL` | Public URL ของ bucket (ไม่ต้องมี `/` ท้าย) |

### ด่านกันบอต (Cloudflare Turnstile) — แนะนำให้เปิดก่อนเปิดให้คนสมัครจริง
1. dash.cloudflare.com → **Turnstile** → Add widget → ใส่โดเมนของเว็บ (เช่น `xxx.vercel.app` และโดเมนจริงถ้ามี) → โหมด Managed
2. เพิ่ม env บน Vercel: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (คีย์สาธารณะ) และ `TURNSTILE_SECRET_KEY` (คีย์ลับ — ใส่เองใน Vercel ห้ามส่งในแชต) แล้ว Redeploy (ค่า `NEXT_PUBLIC_` ถูกฝังตอน build)
3. ถ้าไม่ตั้งสองค่านี้ ระบบจะไม่ตรวจบอต (ใช้ได้ปกติในเครื่อง) · ตัวนับการเดารหัสผ่าน/รหัสสมัครอยู่ในฐานข้อมูล (ตาราง `RateLimitHit`) ทำงานเสมอ ไม่ต้องตั้งค่า: รหัสผ่านผิด 8 ครั้ง/15 นาทีต่อบัญชี (40 ต่อ IP) จะถูกล็อกชั่วคราว

### ท้ายเว็บ ยอดเข้าชม และหน้าข้อมูล
- หลัง deploy ครั้งแรก ไปที่ **แอดมิน › หน้าข้อมูลและ Footer**: ใส่ที่อยู่/โทร/อีเมล/โซเชียล, ตรวจ “เริ่มนับตั้งแต่” และปรับข้อความ นโยบายความเป็นส่วนตัว/เงื่อนไข ให้ผู้รับผิดชอบตรวจ
- ตัวนับผู้เข้าชมเขียนฐานข้อมูลแค่ครั้งแรกของแต่ละคนต่อวัน จึงไม่กระทบโควตา Neon (ไม่มีตัวนับ “ออนไลน์” แล้ว เพราะต้องส่งสัญญาณถี่และทำให้ฐานข้อมูลไม่หลับ)

## 4) Deploy
1. push โค้ดขึ้น GitHub (ห้าม commit `.env`; โฟลเดอร์ `storage/` อยู่ใน `.gitignore` แล้ว)
2. Vercel → Add New Project → เลือก repo → Framework: Next.js (ตรวจเจออัตโนมัติ)
   - Vercel จะใช้สคริปต์ `vercel-build` ใน `package.json` เอง ซึ่งรัน migration ให้ก่อน build
3. ใส่ env ตามข้อ 3 แล้ว Deploy

## 5) หลัง deploy ครั้งแรก
1. สร้างแอดมินในฐานข้อมูลจริง (รันจากเครื่องคุณ ชี้ไปฐานข้อมูลออนไลน์):
   ```bash
   DATABASE_URL="<ลิงก์ตรง>" DIRECT_URL="<ลิงก์ตรง>" \
   SEED_ADMIN_EMAIL="you@example.com" SEED_ADMIN_PASSWORD="<รหัสที่ยาวและไม่ซ้ำ>" npm run db:seed
   ```
   อย่าปล่อยรหัสเริ่มต้น `ChangeMe123!`
2. ถ้ามีไฟล์ในเครื่องที่อยากย้ายขึ้น bucket: ตั้ง `STORAGE_DRIVER=s3` + `S3_*` แล้วรัน `npm run storage:migrate`
3. ล็อกอิน `/login` → `/admin/settings` ตั้งชื่อระบบ/เขต/โลโก้ → ลองอัปโหลดวิดีโอพื้นหลัง (ควรเห็นแถบ % แล้วขึ้น “อัปโหลดเข้าที่เก็บไฟล์แล้ว”)
4. (ไม่บังคับ) `npm run db:demo` เพื่อใส่ข้อมูลตัวอย่าง — ลบได้ด้วย `npm run db:demo:clear`

## ปัญหาที่อาจเจอ
- **อัปโหลดวิดีโอแล้วขึ้น "เชื่อมต่อที่เก็บไฟล์ไม่ได้ (ตรวจสอบ CORS)"** → CORS ของ bucket ยังไม่ได้ตั้ง หรือ `AllowedOrigins` ไม่ตรงกับโดเมนที่ใช้
- **รูป/วิดีโอไม่ขึ้นแต่ไม่มี error** → bucket ยังไม่เปิด public หรือ `S3_PUBLIC_URL` ผิด (ถ้าไม่ตั้ง ไฟล์จะวิ่งผ่านเซิร์ฟเวอร์ `/api/files` ซึ่งช้าและติดขีดจำกัดขนาดของ Vercel ~4.5 MB)
- **build ล้มที่ `prisma migrate deploy`** → `DIRECT_URL` ผิดหรือไม่ได้ตั้ง / ฐานข้อมูลบล็อก IP ของ Vercel
- **Error "too many connections"** → `DATABASE_URL` ไม่ได้ใช้ลิงก์ pooled หรือขาด `connection_limit=1`
- **ล็อกอินแล้วเด้งกลับ** → `NEXTAUTH_URL` ไม่ตรงกับโดเมนจริง หรือ `NEXTAUTH_SECRET` ไม่ได้ตั้ง
- **อัปโหลดโลโก้เกิน 4 MB ไม่ได้** เป็นเพดานของ Vercel ที่คำขอผ่านเซิร์ฟเวอร์ (รูปสไลด์/ภาพพื้นหลังไม่ติด เพราะย่อในเบราว์เซอร์ก่อน)
- วิดีโอที่ยังไม่ผ่านการบีบอัด (>30 MB) ต้องบีบก่อนอัปโหลด — แนะนำ MP4 1080p ไม่เกิน 15 MB ไม่มีเสียง

## ระบบคอร์สเรียน (ผลต่อฐานข้อมูลและการตั้งค่า)
- migration `20261012000000_course_system` เพิ่มตารางคอร์ส/บทเรียน/แบบทดสอบ/ความคืบหน้า — รัน `prisma migrate deploy` ตอน deploy ตามปกติ (ไม่แตะข้อมูลสมาชิก/สื่อ) · ข้อมูลตัวอย่าง `npm run db:demo:courses` ใช้ได้เฉพาะฐานข้อมูลในเครื่อง (ปฏิเสธการรันกับ Neon)
- **ไม่นับการดูวิดีโอ** (ตัดออกเพื่อประหยัดโควตา Neon): ผู้เรียนเขียนฐานข้อมูลเฉพาะตอนกด “ฉันเรียนบทนี้แล้ว” หรือส่งคำตอบแบบทดสอบ · โฆษณาของ YouTube ตัดไม่ได้ — แนะนำผู้สอนใช้วิดีโอจากช่องของตนเอง
- ผู้สร้างคอร์สต้องได้รับอนุมัติเป็นผู้สร้าง (หน้าผู้ใช้ของแอดมิน) และคอร์สต้องผ่านผู้ตรวจของกลุ่มสาระหรือแอดมินก่อนเผยแพร่

## ย้ายไป VPS ภายหลัง
ใช้ตัวเก็บไฟล์ S3 เดิมได้เลย (R2 หรือ MinIO ที่ติดตั้งบน VPS) ฐานข้อมูลเปลี่ยนแค่ `DATABASE_URL`/`DIRECT_URL` — รัน `docker compose` (app + postgres + reverse proxy) ไม่ต้องแก้โค้ด
