import Link from "next/link";
import { requireManagerPage } from "@/lib/permissions";
import ImportClient from "./import-client";

export default async function ImportSchoolsPage() {
  await requireManagerPage();
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/schools" className="text-sm text-brand">← ทำเนียบโรงเรียน</Link>
        <h1 className="text-2xl font-bold">นำเข้าโรงเรียนจาก Excel</h1>
        <p className="text-sm text-neutral-500">ระบบแสดงตัวอย่างก่อนบันทึกเสมอ — ยังไม่มีอะไรถูกบันทึกจนกว่าจะกดยืนยัน อีเมลในไฟล์จะถูกสร้างเป็นบัญชีผู้ใช้ของโรงเรียน</p>
      </div>
      <ImportClient />
    </div>
  );
}
