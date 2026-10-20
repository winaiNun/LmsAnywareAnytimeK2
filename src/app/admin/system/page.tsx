import Link from "next/link";
import { BACKUP_TEXT, backupState } from "@/lib/backup-status";
import { db } from "@/lib/db";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";
export const metadata = { title: "สถานะระบบ" };

const TONE = { never: "bg-red-50 text-red-700", ok: "bg-green-50 text-green-700", old: "bg-amber-50 text-amber-800", stale: "bg-red-50 text-red-700" } as const;
const card = "space-y-3 rounded-2xl bg-white p-5 shadow-sm";
const code = "block overflow-x-auto whitespace-pre rounded-lg bg-neutral-900 px-3 py-2 text-xs text-neutral-100";

/** Is the system healthy, are there copies of the data, and who will notice if it goes down. Admins only. */
export default async function SystemPage() {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  const t0 = Date.now();
  const [setting, openErrors, errors24] = await Promise.all([
    db.siteSetting.findUnique({ where: { id: "main" }, select: { lastBackupAt: true, lastBackupNote: true, lastRestoreCheckAt: true } }),
    db.errorLog.count({ where: { resolvedAt: null } }),
    db.errorLog.count({ where: { resolvedAt: null, lastAt: { gte: new Date(Date.now() - 86400000) } } }),
  ]);
  const dbMs = Date.now() - t0;
  const b = backupState(setting?.lastBackupAt ?? null);
  const origin = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const storage = process.env.STORAGE_DRIVER ?? "local";
  const durable = storage === "s3" || !process.env.VERCEL;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">สถานะระบบ</h1>
        <p className="text-sm text-neutral-500">สุขภาพของระบบ การสำรองข้อมูล และการเฝ้าระวัง — เห็นเฉพาะผู้ดูแลระบบ</p>
      </div>

      <section className={card} aria-label="สถานะตอนนี้">
        <h2 className="font-semibold">ตอนนี้</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["ฐานข้อมูล", `ตอบสนองใน ${dbMs} ms`],
            ["ที่เก็บไฟล์", `${storage === "s3" ? "S3 / R2" : "ในเครื่องเซิร์ฟเวอร์"}${durable ? "" : " — ไม่ถาวรบน Vercel"}`],
            ["ตัวตรวจบอตหน้าสมัคร", process.env.TURNSTILE_SECRET_KEY ? "เปิดอยู่" : "ปิดอยู่ (ไม่ตรวจ)"],
            ["สภาพแวดล้อม", process.env.VERCEL ? "Vercel (ใช้งานจริง)" : "เครื่องพัฒนา"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-neutral-50 p-3">
              <dt className="text-xs text-neutral-500">{k}</dt>
              <dd className="mt-0.5 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm">
          ข้อผิดพลาดที่ยังไม่แก้ <strong>{openErrors}</strong> รายการ (24 ชั่วโมงล่าสุด {errors24}) — <Link href="/admin/errors" className="text-brand hover:underline">ดูรายการ</Link> · <Link href="/admin/audit" className="text-brand hover:underline">บันทึกการใช้งาน</Link>
        </p>
      </section>

      <section className={card} aria-label="สำรองข้อมูล">
        <h2 className="font-semibold">สำรองข้อมูล (ฐานข้อมูล)</h2>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TONE[b.state]}`}>{BACKUP_TEXT[b.state]}</span>
          {setting?.lastBackupAt && <span>ล่าสุด {formatThaiDate(setting.lastBackupAt, { time: true })}{b.days !== null && b.days > 0 ? ` (${b.days} วันก่อน)` : ""}</span>}
        </p>
        {setting?.lastBackupNote && <p className="text-xs text-neutral-500">{setting.lastBackupNote}</p>}
        <p className="text-sm">
          ทดสอบกู้คืนล่าสุด: {setting?.lastRestoreCheckAt ? <strong className="text-green-700">{formatThaiDate(setting.lastRestoreCheckAt, { time: true })} — ผ่าน</strong> : <strong className="text-amber-700">ยังไม่เคยทดสอบ</strong>}
          <span className="block text-xs text-neutral-500">ไฟล์สำรองที่ไม่เคยลองกู้คืนยังเป็นแค่ความหวัง — ควรทดสอบอย่างน้อยหลังตั้งระบบใหม่และทุกไม่กี่เดือน</span>
        </p>
        <div className="space-y-2 text-sm">
          <p className="font-medium">วิธีสำรองและทดสอบ (รันที่เครื่องของผู้ดูแล ในโฟลเดอร์โปรเจกต์ ชี้ฐานข้อมูลที่ต้องการสำรองใน <code>.env</code>)</p>
          <code className={code}>{"npm run db:backup          # สร้างไฟล์ในโฟลเดอร์ backups/ (เก็บ 14 ชุดล่าสุด) แล้วบันทึกเวลาไว้ที่หน้านี้\nnpm run db:restore-check    # ลองกู้ไฟล์ล่าสุดลงฐานข้อมูลชั่วคราวในเครื่อง นับตาราง แล้วลบทิ้ง"}</code>
          <p className="text-xs text-neutral-500">ไฟล์ <code>backups/</code> มีข้อมูลสมาชิกทั้งหมด — เก็บในที่ปลอดภัย (ฮาร์ดดิสก์เข้ารหัส/ที่เก็บของหน่วยงาน) ห้ามส่งขึ้น GitHub หรือแชต · ที่เก็บไฟล์ภาพ/วิดีโอ (R2) ไม่อยู่ในไฟล์นี้ ดูวิธีใน DEPLOY.md หัวข้อ “สำรองและกู้คืน”</p>
        </div>
      </section>

      <section className={card} aria-label="เฝ้าระวังระบบล่ม">
        <h2 className="font-semibold">แจ้งเตือนเมื่อระบบล่ม</h2>
        <p className="text-sm text-neutral-700">ตัวระบบแจ้งตัวเองไม่ได้ตอนที่ล่ม จึงใช้บริการเฝ้าดูจากภายนอกที่ฟรี เช่น UptimeRobot ให้ตรวจที่อยู่ด้านล่างทุก 5 นาที และส่งอีเมล/LINE ถึงผู้ดูแลเมื่อไม่ตอบ (ที่อยู่นี้ตอบ 200 เมื่อเว็บและฐานข้อมูลปกติ, 503 เมื่อฐานข้อมูลไม่ตอบ และไม่เปิดเผยข้อมูลอื่นเลย)</p>
        <code className={code}>{origin ? `${origin}/api/health` : "https://<โดเมนของคุณ>/api/health"}</code>
        <p className="text-xs text-neutral-500">ตั้งค่าครั้งเดียวที่เว็บของบริการนั้น (ไม่ต้องแก้โค้ด) · ใช้ HTTP(s) monitor แบบ Status 200</p>
      </section>
    </div>
  );
}
