import Glyph from "@/components/glyph";
import { db } from "@/lib/db";
import { requireManagerPage } from "@/lib/permissions";
import { resourceImageOf } from "@/lib/resource-image";
import { getSiteInfo } from "@/lib/site";
import ResourceIcon from "@/components/resource-icon";
import ResourceForm from "./resource-form";
import RowActions from "./row-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "แหล่งสื่อภายนอก" };

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

export default async function ResourcesAdminPage({ searchParams }: { searchParams: { edit?: string } }) {
  await requireManagerPage();
  const [rows, site] = await Promise.all([db.resourceLink.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }), getSiteInfo()]);
  const groups = Array.from(new Set(rows.map((r) => r.groupName)));
  const editing = searchParams.edit ? rows.find((r) => r.id === searchParams.edit) : undefined;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">แหล่งสื่อภายนอก</h1>
        <p className="text-sm text-neutral-500">ทำเนียบเว็บไซต์/ช่องทางที่แนะนำ แสดงในหน้า “แหล่งสื่อภายนอก” หน้าแรก และท้ายเว็บ (6 รายการแรกตามลำดับ) · ลิงก์ต้องเป็น https เท่านั้น</p>
      </div>

      <ResourceForm
        values={
          editing
            ? { id: editing.id, name: editing.name, url: editing.url, description: editing.description ?? "", groupName: editing.groupName, icon: editing.icon, color: editing.color, active: editing.active }
            : { name: "", url: "", description: "", groupName: "ทั่วไป", icon: "globe", color: "#0052FF", active: true }
        }
        groups={groups}
        image={editing ? resourceImageOf(editing) : null}
        allowUpload={site.allowServerUploads}
      />

      <div className="overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-neutral-500">
            <tr>{["", "ชื่อ", "กลุ่ม", "คลิก", "สถานะ", "จัดการ"].map((h, i) => <th key={i} className="p-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-neutral-100 align-middle">
                <td className="w-14 p-3"><ResourceIcon image={resourceImageOf(r)} icon={r.icon} color={r.color} size={40} /></td>
                <td className="p-3">
                  <p className="font-medium">{r.name}</p>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">{hostOf(r.url)}<Glyph name="external-link" size={12} /></a>
                </td>
                <td className="p-3 text-neutral-600">{r.groupName}</td>
                <td className="p-3 tabular-nums">{r.clickCount.toLocaleString("th-TH")}</td>
                <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.active ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>{r.active ? "แสดง" : "ซ่อน"}</span></td>
                <td className="p-3"><RowActions id={r.id} active={r.active} first={i === 0} last={i === rows.length - 1} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-500">ยังไม่มีรายการ — เพิ่มด้านบน</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
