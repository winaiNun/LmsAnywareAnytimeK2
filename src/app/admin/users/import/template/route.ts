import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildSpreadsheet } from "@/lib/excel";
import { isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const HEADERS = ["ชื่อผู้ใช้/รหัสประจำตัว", "อีเมล", "คำนำหน้า", "ชื่อ", "นามสกุล", "ประเภท", "โรงเรียน", "ตำแหน่ง/ชั้น", "รหัสผ่าน"];

/** Blank import template with example rows (delete them before uploading). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) return new Response("Forbidden", { status: 403 });

  const file = await buildSpreadsheet(
    "สมาชิก",
    HEADERS,
    [
      ["65001", "", "เด็กชาย", "สมชาย", "ใจดี", "นักเรียน", "30020009", "ป.5", ""],
      ["somying.t", "somying@example.com", "นางสาว", "สมหญิง", "รักเรียน", "ครู", "โรงเรียนตัวอย่างหนึ่ง", "ครูชำนาญการ", ""],
      ["", "director@example.ac.th", "นาง", "สมใจ", "บริหารดี", "ผู้บริหารสถานศึกษา", "โรงเรียนตัวอย่างสอง", "ผู้อำนวยการโรงเรียน", ""],
      ["", "supervisor@example.go.th", "นาย", "ประสิทธิ์", "นิเทศดี", "ศึกษานิเทศก์", "สพป.นครราชสีมา เขต 2", "ศึกษานิเทศก์ชำนาญการ", ""],
    ],
    [24, 28, 12, 16, 16, 16, 30, 22, 16],
  );
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="members-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
