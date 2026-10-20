"use client";

import Link from "next/link";
import { useState } from "react";
import { Spinner } from "@/components/icons";
import { MEMBER_TYPE_LABEL, composePersonName } from "@/lib/members";
import { commitUserChunk, finishUserImport, previewUserImport, type CommitOutcome, type PreviewResult, type PreviewRow } from "./actions";

const CHUNK = 20;
const ACTION_LABEL: Record<PreviewRow["action"], [string, string]> = {
  new: ["เพิ่มใหม่", "bg-green-50 text-green-700"],
  update: ["อัปเดต", "bg-blue-50 text-brand"],
  same: ["ไม่เปลี่ยน", "bg-neutral-100 text-neutral-600"],
  error: ["มีปัญหา", "bg-red-50 text-red-700"],
};

type Done = { created: number; updated: number; unchanged: number; failed: { key: string; error: string }[]; credentials: NonNullable<CommitOutcome["credential"]>[] };

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export default function ImportClient() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Extract<PreviewResult, { ok: true }> | null>(null);
  const [reset, setReset] = useState(false);
  const [filter, setFilter] = useState<PreviewRow["action"] | "all" | "warn">("all");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  async function check(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setPreview(null); setDone(null);
    setBusy(true);
    const res = await previewUserImport(new FormData(e.currentTarget));
    setBusy(false);
    if (!res.ok) setError(res.error);
    else setPreview(res);
  }

  const toSave = (p: Extract<PreviewResult, { ok: true }>) => p.rows.filter((r) => r.action === "new" || r.action === "update" || (reset && r.action === "same"));

  async function commit() {
    if (!preview) return;
    const rows = toSave(preview);
    setBusy(true); setError("");
    const result: Done = { created: 0, updated: 0, unchanged: 0, failed: [], credentials: [] };
    setProgress({ done: 0, total: rows.length });
    for (let i = 0; i < rows.length; i += CHUNK) {
      const res = await commitUserChunk(
        rows.slice(i, i + CHUNK).map((r) => ({ username: r.username, email: r.email, prefix: r.prefix, firstName: r.firstName, lastName: r.lastName, memberType: r.memberType, schoolText: r.schoolLabel, schoolId: r.schoolId, organization: r.organization, position: r.position, gradeLevel: r.gradeLevel, password: r.password })),
        { resetPasswords: reset },
      );
      if (!res.ok) { setError(res.error ?? "บันทึกไม่สำเร็จ"); break; }
      for (const o of res.outcomes) {
        if (o.result === "created") result.created++;
        else if (o.result === "updated") result.updated++;
        else if (o.result === "unchanged") result.unchanged++;
        else result.failed.push({ key: o.key, error: o.error ?? "ไม่สำเร็จ" });
        if (o.credential) result.credentials.push(o.credential);
      }
      setProgress({ done: Math.min(i + CHUNK, rows.length), total: rows.length });
    }
    await finishUserImport({ fileName: preview.fileName, created: result.created, updated: result.updated, unchanged: result.unchanged, failed: result.failed.length, passwordsIssued: result.credentials.length });
    setDone(result); setBusy(false); setPreview(null);
  }

  function downloadCredentials() {
    if (!done) return;
    const origin = window.location.origin;
    const head = ["ชื่อผู้ใช้/อีเมล", "ชื่อ", "ประเภท", "รหัสผ่านชั่วคราว", "เข้าสู่ระบบที่"];
    const lines = [head, ...done.credentials.map((c) => [c.login, c.name, c.type, c.password, `${origin}/login`])].map((r) => r.map(csvCell).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "members-temporary-passwords.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const visible = preview?.rows.filter((r) => (filter === "all" ? true : filter === "warn" ? r.warnings.length > 0 && r.action !== "error" : r.action === filter)) ?? [];
  const saving = preview ? toSave(preview).length : 0;

  return (
    <div className="space-y-5">
      <form onSubmit={check} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
        <label className="block space-y-1">
          <span className="text-sm font-medium">เลือกไฟล์ Excel (.xlsx) หรือ .csv — ไม่เกิน 5 MB / 2,000 แถว</span>
          <input type="file" name="file" accept=".xlsx,.csv" required className="block w-full text-sm" disabled={busy} />
        </label>
        <p className="text-xs text-neutral-500">
          หัวคอลัมน์: ชื่อผู้ใช้/รหัสประจำตัว · อีเมล · คำนำหน้า · ชื่อ · นามสกุล · ประเภท (นักเรียน/ครู/ผู้บริหารสถานศึกษา/ศึกษานิเทศก์/ผู้บริหารสำนักงานเขต/บุคคลทั่วไป) · โรงเรียน (ใช้รหัสโรงเรียนหรือชื่อตามทำเนียบ) · ตำแหน่ง/ชั้น · รหัสผ่าน (ไม่บังคับ) ลำดับสลับได้ มีชื่อผู้ใช้หรืออีเมลอย่างน้อยหนึ่งอย่าง{" "}
          (<a href="/admin/users/import/template" className="text-brand underline">ดาวน์โหลดแม่แบบ</a>)
        </p>
        <button disabled={busy} className="flex min-h-11 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-white disabled:opacity-60">{busy && !progress ? <Spinner className="h-4 w-4" /> : null}ตรวจไฟล์</button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>

      {preview && (
        <section className="space-y-4" aria-label="ตัวอย่างก่อนบันทึก">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {([["แถวทั้งหมด", preview.counts.total, "all", "text-neutral-900"], ["เพิ่มใหม่", preview.counts.new, "new", "text-green-700"], ["อัปเดต", preview.counts.update, "update", "text-brand"], ["ไม่เปลี่ยน", preview.counts.same, "same", "text-neutral-600"], ["มีปัญหา (ข้าม)", preview.counts.error, "error", "text-red-700"], ["มีข้อสังเกต", preview.counts.warnings, "warn", "text-amber-700"]] as const).map(([label, n, f, tone]) => (
              <button key={label} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-xl bg-white p-3 text-left shadow-sm ring-2 ${filter === f ? "ring-brand" : "ring-transparent"}`}>
                <span className="block text-xs text-neutral-500">{label}</span><span className={`text-2xl font-bold ${tone}`}>{n}</span>
              </button>
            ))}
          </div>

          <p className="text-sm text-neutral-600">จะสร้างรหัสผ่านชั่วคราวให้ <strong>{preview.counts.passwords}</strong> บัญชีใหม่ (แถวที่ไม่มีรหัสผ่านในไฟล์) ให้ดาวน์โหลดหลังบันทึก</p>

          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm">
            <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} className="h-4 w-4" />
            รีเซ็ตรหัสผ่านของบัญชีที่มีอยู่แล้วในไฟล์ด้วย (ปกติไม่แตะรหัสผ่าน; ถ้าติ๊ก ผู้ใช้เหล่านั้นต้องตั้งรหัสใหม่และ PIN บนมือถือถูกยกเลิก)
          </label>

          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500"><tr>{["แถว", "ผล", "ชื่อผู้ใช้ / อีเมล", "ชื่อ-นามสกุล", "ประเภท", "โรงเรียน / หน่วยงาน", "หมายเหตุ"].map((h) => <th key={h} className="p-2.5 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.line} className="border-t border-neutral-100 align-top">
                    <td className="p-2.5 text-neutral-400">{r.line}</td>
                    <td className="p-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_LABEL[r.action][1]}`}>{ACTION_LABEL[r.action][0]}</span></td>
                    <td className="p-2.5 text-neutral-700">{r.username ?? "—"}{r.email && <span className="block text-xs text-neutral-500">{r.email}</span>}</td>
                    <td className="p-2.5 font-medium">{composePersonName(r.prefix, r.firstName, r.lastName)}</td>
                    <td className="p-2.5">{r.memberType ? MEMBER_TYPE_LABEL[r.memberType] : "—"}</td>
                    <td className="p-2.5 text-neutral-600">{r.schoolName ?? r.organization ?? (r.schoolLabel || "—")}{(r.gradeLevel ?? r.position) && <span className="block text-xs text-neutral-500">{r.gradeLevel ?? r.position}</span>}</td>
                    <td className="p-2.5 text-xs">
                      {r.errors.map((e) => <p key={e} className="text-red-700">✕ {e}</p>)}
                      {r.changes.length > 0 && <p className="text-brand">แก้: {r.changes.join(", ")}</p>}
                      {r.action === "new" && <p className="text-neutral-500">{r.passwordPlan === "file" ? "ใช้รหัสผ่านจากไฟล์" : "ระบบสร้างรหัสผ่านชั่วคราว"}</p>}
                      {r.warnings.map((w) => <p key={w} className="text-amber-700">! {w}</p>)}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-neutral-500">ไม่มีแถวในกลุ่มนี้</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={commit} disabled={busy || saving === 0} className="flex min-h-12 items-center gap-2 rounded-xl bg-brand px-7 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
              {busy && <Spinner className="h-4 w-4" />}ยืนยันนำเข้า {saving} รายการ
            </button>
            {progress && busy && <span role="status" className="text-sm text-neutral-600">กำลังบันทึก {progress.done}/{progress.total}…</span>}
            {preview.counts.error > 0 && <span className="text-sm text-red-700">แถวที่มีปัญหา {preview.counts.error} แถวจะถูกข้าม</span>}
            {saving === 0 && <span className="text-sm text-neutral-500">ไม่มีรายการที่ต้องบันทึก</span>}
          </div>
        </section>
      )}

      {done && (
        <section className="space-y-4 rounded-xl border border-green-300 bg-green-50 p-5" role="status" aria-label="ผลการนำเข้า">
          <h2 className="text-lg font-bold text-green-900">นำเข้าเสร็จแล้ว</h2>
          <p className="text-sm text-green-900">เพิ่มใหม่ {done.created} · อัปเดต {done.updated} · ไม่เปลี่ยน {done.unchanged} · ไม่สำเร็จ {done.failed.length} · ออกรหัสผ่านชั่วคราว {done.credentials.length}</p>
          {done.failed.length > 0 && <ul className="list-disc pl-5 text-sm text-red-700">{done.failed.slice(0, 10).map((f) => <li key={f.key}>{f.key}: {f.error}</li>)}</ul>}
          {done.credentials.length > 0 && (
            <div className="space-y-2 rounded-lg bg-white p-4">
              <p className="text-sm"><strong>รหัสผ่านชั่วคราวของ {done.credentials.length} บัญชี</strong> แสดงได้ครั้งเดียว — ดาวน์โหลดเก็บไว้ก่อนปิดหน้านี้ (ในระบบเก็บเฉพาะค่าเข้ารหัส ดูย้อนหลังไม่ได้ แต่ออกรหัสใหม่รายคนได้จากหน้าสมาชิก) ผู้ใช้ต้องตั้งรหัสผ่านใหม่ตอนเข้าสู่ระบบครั้งแรก</p>
              <button onClick={downloadCredentials} className="min-h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-white">ดาวน์โหลดรหัสผ่านชั่วคราว (.csv — เปิดด้วย Excel ได้)</button>
              <p className="text-xs text-amber-700">ไฟล์นี้เป็นความลับ — แจกให้แต่ละคนเฉพาะของตัวเอง และลบไฟล์เมื่อแจกเสร็จ</p>
            </div>
          )}
          <Link href="/admin/users" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 bg-white px-5 text-sm">ไปที่รายชื่อสมาชิก</Link>
        </section>
      )}
    </div>
  );
}
