import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildSpreadsheet } from "@/lib/excel";
import { isManager } from "@/lib/permissions";
import { compareThai, sortName } from "@/lib/schools-data";

export const dynamic = "force-dynamic";

/** Current directory as a spreadsheet (same columns as the import template + status columns). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isManager(session.user.role)) return new Response("Forbidden", { status: 403 });

  const schools = (await db.school.findMany({ include: { account: { select: { mustChangePassword: true } } } })).sort(
    (a, b) => compareThai(a.district, b.district) || compareThai(a.center, b.center) || compareThai(sortName(a.name), sortName(b.name)),
  );
  const file = await buildSpreadsheet(
    "ฐานข้อมูลโรงเรียน",
    ["รหัสโรงเรียน", "อีเมล", "อำเภอ", "ศูนย์เครือข่าย", "ชื่อโรงเรียน", "ลิงก์ Anywhere Anytime", "ลิงก์การ์ด", "สถานะแสดงผล", "ภาพการ์ด", "บัญชีผู้ใช้"],
    schools.map((s) => [s.code, s.email, s.district, s.center, s.name, s.siteUrl, s.cardSourceUrl, s.active ? "แสดง" : "ปิด", s.cardKey ? "มี" : "ไม่มี", s.accountId ? (s.account?.mustChangePassword ? "รอเปลี่ยนรหัส" : "ใช้งานแล้ว") : "ไม่มี"]),
    [16, 30, 16, 18, 34, 60, 60, 12, 10, 14],
  );
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="schools-export.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
