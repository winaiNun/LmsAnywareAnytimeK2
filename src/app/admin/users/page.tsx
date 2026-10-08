import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE: Record<string, [string, string]> = {
  ADMIN: ["ผู้ดูแลระบบ", "bg-purple-50 text-purple-700"],
  LIBRARIAN: ["บรรณารักษ์", "bg-blue-50 text-brand"],
  TEACHER: ["ครู/ผู้สอน", "bg-amber-50 text-amber-700"],
  STUDENT: ["สมาชิกทั่วไป", "bg-neutral-100 text-neutral-600"],
};

export default async function UsersPage() {
  const [users, total] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { _count: { select: { loans: true, enrollments: true } } } }),
    db.user.count(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">สมาชิก</h1>
        <p className="text-sm text-neutral-500">ทั้งหมด {total} คน (แสดง 50 รายการล่าสุด)</p>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white p-2 shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-neutral-500">
            <tr><th className="p-3 font-medium">ชื่อ</th><th className="p-3 font-medium">อีเมล</th><th className="p-3 font-medium">บทบาท</th><th className="p-3 font-medium">ยืม</th><th className="p-3 font-medium">คอร์ส</th><th className="p-3 font-medium">สถานะ</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3 text-neutral-600">{u.email}</td>
                <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${ROLE[u.role][1]}`}>{ROLE[u.role][0]}</span></td>
                <td className="p-3">{u._count.loans}</td>
                <td className="p-3">{u._count.enrollments}</td>
                <td className="p-3">{u.active ? <span className="text-green-700">ใช้งานอยู่</span> : <span className="text-neutral-400">ปิดใช้งาน</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
