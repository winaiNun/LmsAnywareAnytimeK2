import Link from "next/link";
import { isAdmin, requireManagerPage } from "@/lib/permissions";
import ImportClient from "./import-client";

export default async function ImportUsersPage() {
  const me = await requireManagerPage();
  if (!isAdmin(me.role)) return <p className="p-6">เฉพาะผู้ดูแลระบบเท่านั้น</p>;
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/users" className="text-sm text-brand">← สมาชิกทั้งหมด</Link>
        <h1 className="text-2xl font-bold">นำเข้าสมาชิกจาก Excel</h1>
        <p className="text-sm text-neutral-500">ระบบแสดงตัวอย่างก่อนบันทึกเสมอ — ยังไม่มีอะไรถูกบันทึกจนกว่าจะกดยืนยัน แถวที่ไม่ได้ใส่รหัสผ่านระบบจะสร้างรหัสชั่วคราวให้ (ผู้ใช้ต้องตั้งรหัสใหม่ตอนเข้าครั้งแรก)</p>
      </div>
      <ImportClient />
    </div>
  );
}
