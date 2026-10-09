import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildSpreadsheet } from "@/lib/excel";
import { MEMBER_TYPE_LABEL } from "@/lib/members";
import { isAdmin } from "@/lib/permissions";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";

/** Member list for reports (by type / school / district). Admin only: it holds personal data. */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user.role)) return new Response("Forbidden", { status: 403 });

  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");
  const school = sp.get("school");
  const users = await db.user.findMany({
    where: { ...(type && type in MEMBER_TYPE_LABEL && { memberType: type as "STUDENT" }), ...(school && { schoolId: school }) },
    include: { memberSchool: { select: { name: true, district: true, center: true } } },
    orderBy: [{ memberType: "asc" }, { name: "asc" }],
  });
  const file = await buildSpreadsheet(
    "สมาชิก",
    ["ประเภท", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่อผู้ใช้", "อีเมล", "เบอร์โทร", "โรงเรียน", "อำเภอ", "ศูนย์เครือข่าย", "หน่วยงาน", "ตำแหน่ง", "ชั้น", "สิทธิ์", "สถานะ", "สมัครเมื่อ"],
    users.map((u) => [
      MEMBER_TYPE_LABEL[u.memberType], u.prefix, u.firstName ?? u.name, u.lastName, u.username, u.email, u.phone,
      u.memberSchool?.name ?? null, u.memberSchool?.district ?? null, u.memberSchool?.center ?? null, u.organization, u.position, u.gradeLevel,
      u.role, u.active ? "ใช้งาน" : "ปิด", formatThaiDate(u.createdAt),
    ]),
    [12, 10, 18, 18, 16, 28, 14, 30, 14, 16, 24, 20, 8, 12, 8, 14],
  );
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="members-export.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
