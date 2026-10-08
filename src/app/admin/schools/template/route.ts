import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildSpreadsheet } from "@/lib/excel";
import { isManager } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const HEADERS = ["รหัสโรงเรียน", "อีเมล", "อำเภอ", "ศูนย์เครือข่าย", "ชื่อโรงเรียน", "ลิงก์ Anywhere Anytime", "ลิงก์การ์ด"];

/** Blank import template with two example rows. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isManager(session.user.role)) return new Response("Forbidden", { status: 403 });

  const file = await buildSpreadsheet(
    "ฐานข้อมูลโรงเรียน",
    HEADERS,
    [
      ["30020009", "30020009@example.go.th", "จักราช", "จักราช 1", "โรงเรียนตัวอย่างหนึ่ง", "https://sites.google.com/example/school-one/anywhere-anytime", "https://drive.google.com/file/d/ตัวอย่างรหัสไฟล์/view?usp=sharing"],
      ["30020010", "30020010@example.go.th", "จักราช", "จักราช 1", "โรงเรียนตัวอย่างสอง", "", ""],
    ],
    [16, 30, 16, 18, 34, 60, 60],
  );
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="schools-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
