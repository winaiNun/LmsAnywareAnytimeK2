"use client";

import Link from "next/link";
import { useState } from "react";
import { Spinner } from "@/components/icons";
import CardJob from "../card-job";
import { commitSchoolChunk, finishSchoolImport, previewSchoolImport, type CommitOutcome, type PreviewResult, type PreviewRow } from "../actions";

const CHUNK = 25;
const ACTION_LABEL: Record<PreviewRow["action"], [string, string]> = {
  new: ["เพิ่มใหม่", "bg-green-50 text-green-700"],
  update: ["อัปเดต", "bg-blue-50 text-brand"],
  same: ["ไม่เปลี่ยน", "bg-neutral-100 text-neutral-600"],
  error: ["มีปัญหา", "bg-red-50 text-red-700"],
};

type Done = { created: number; updated: number; unchanged: number; failed: { code: string; error: string }[]; credentials: NonNullable<CommitOutcome["credential"]>[] };

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export default function ImportClient() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Extract<PreviewResult, { ok: true }> | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [filter, setFilter] = useState<PreviewRow["action"] | "all" | "warn">("all");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  async function check(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setPreview(null); setDone(null);
    setBusy(true);
    const res = await previewSchoolImport(new FormData(e.currentTarget));
    setBusy(false);
    if (!res.ok) setError(res.error);
    else setPreview(res);
  }

  async function commit() {
    if (!preview) return;
    const rows = preview.rows.filter((r) => r.action !== "error" && r.action !== "same");
    // "same" rows still go through when links should be overwritten, but only if something would differ
    setBusy(true); setError("");
    const result: Done = { created: 0, updated: 0, unchanged: 0, failed: [], credentials: [] };
    setProgress({ done: 0, total: rows.length });
    for (let i = 0; i < rows.length; i += CHUNK) {
      const res = await commitSchoolChunk(
        rows.slice(i, i + CHUNK).map((r) => ({ code: r.code, email: r.email, district: r.district, center: r.center, name: r.name, siteUrl: r.siteUrl, cardSourceUrl: r.cardSourceUrl })),
        { overwriteLinks: overwrite },
      );
      if (!res.ok) { setError(res.error ?? "บันทึกไม่สำเร็จ"); break; }
      for (const o of res.outcomes) {
        if (o.result === "created") result.created++;
        else if (o.result === "updated") result.updated++;
        else if (o.result === "unchanged") result.unchanged++;
        else result.failed.push({ code: o.code, error: o.error ?? "ไม่สำเร็จ" });
        if (o.credential) result.credentials.push(o.credential);
      }
      setProgress({ done: Math.min(i + CHUNK, rows.length), total: rows.length });
    }
    await finishSchoolImport({ fileName: preview.fileName, created: result.created, updated: result.updated, unchanged: result.unchanged, failed: result.failed.length, accountsCreated: result.credentials.length });
    setDone(result); setBusy(false); setPreview(null);
  }

  function downloadCredentials() {
    if (!done) return;
    const origin = window.location.origin;
    const head = ["รหัสโรงเรียน", "ชื่อโรงเรียน", "อีเมล (ชื่อผู้ใช้)", "รหัสผ่านชั่วคราว", "เข้าสู่ระบบที่"];
    const lines = [head, ...done.credentials.map((c) => [c.code, c.name, c.email, c.password, `${origin}/login`])].map((r) => r.map(csvCell).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "school-accounts-temporary-passwords.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const visible = preview?.rows.filter((r) => (filter === "all" ? true : filter === "warn" ? r.warnings.length > 0 && r.action !== "error" : r.action === filter)) ?? [];
  const toSave = preview ? preview.rows.filter((r) => r.action === "new" || r.action === "update").length : 0;

  return (
    <div className="space-y-5">
      <form onSubmit={check} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
        <label className="block space-y-1">
          <span className="text-sm font-medium">เลือกไฟล์ Excel (.xlsx) หรือ .csv — ไม่เกิน 5 MB / 2,000 แถว</span>
          <input type="file" name="file" accept=".xlsx,.csv" required className="block w-full text-sm" disabled={busy} />
        </label>
        <p className="text-xs text-neutral-500">หัวคอลัมน์ที่ใช้: รหัสโรงเรียน · อีเมล · อำเภอ · ศูนย์เครือข่าย · ชื่อโรงเรียน · ลิงก์ Anywhere Anytime · ลิงก์การ์ด (ลำดับสลับได้, <a href="/admin/schools/template" className="text-brand underline">ดาวน์โหลดแม่แบบ</a>)</p>
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

          <p className="text-sm text-neutral-600">จะสร้างบัญชีผู้ใช้ใหม่ <strong>{preview.counts.accountsToCreate}</strong> บัญชี (รหัสผ่านชั่วคราวแบบสุ่ม ให้ดาวน์โหลดหลังบันทึก)
            {preview.duplicateNames.length > 0 && <> · ชื่อซ้ำกัน (ต่างอำเภอ ถือเป็นคนละโรงเรียน): {preview.duplicateNames.join(", ")}</>}</p>

          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="h-4 w-4" />
            ทับลิงก์เว็บไซต์/ลิงก์การ์ดของโรงเรียนที่มีอยู่แล้ว (ปกติไม่ทับ เพราะโรงเรียนอาจแก้เองไว้)
          </label>

          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500"><tr>{["แถว", "ผล", "รหัส", "ชื่อโรงเรียน", "อำเภอ / ศูนย์", "อีเมล", "หมายเหตุ"].map((h) => <th key={h} className="p-2.5 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.line} className="border-t border-neutral-100 align-top">
                    <td className="p-2.5 text-neutral-400">{r.line}</td>
                    <td className="p-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_LABEL[r.action][1]}`}>{ACTION_LABEL[r.action][0]}</span></td>
                    <td className="p-2.5 tabular-nums">{r.code}</td>
                    <td className="p-2.5 font-medium">{r.name}</td>
                    <td className="p-2.5 text-neutral-600">{r.district} / {r.center}</td>
                    <td className="p-2.5 text-neutral-600">{r.email ?? "—"}{r.account === "create" && <span className="ml-1 text-xs text-green-700">(สร้างบัญชี)</span>}</td>
                    <td className="p-2.5 text-xs">
                      {r.errors.map((e) => <p key={e} className="text-red-700">✕ {e}</p>)}
                      {r.changes.length > 0 && <p className="text-brand">แก้: {r.changes.join(", ")}</p>}
                      {r.warnings.map((w) => <p key={w} className="text-amber-700">! {w}</p>)}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-neutral-500">ไม่มีแถวในกลุ่มนี้</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={commit} disabled={busy || toSave === 0} className="flex min-h-12 items-center gap-2 rounded-xl bg-brand px-7 font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
              {busy && <Spinner className="h-4 w-4" />}ยืนยันนำเข้า {toSave} โรงเรียน
            </button>
            {progress && busy && <span role="status" className="text-sm text-neutral-600">กำลังบันทึก {progress.done}/{progress.total}…</span>}
            {preview.counts.error > 0 && <span className="text-sm text-red-700">แถวที่มีปัญหา {preview.counts.error} แถวจะถูกข้าม</span>}
            {toSave === 0 && <span className="text-sm text-neutral-500">ไม่มีรายการที่ต้องบันทึก</span>}
          </div>
        </section>
      )}

      {done && (
        <section className="space-y-4 rounded-xl border border-green-300 bg-green-50 p-5" role="status" aria-label="ผลการนำเข้า">
          <h2 className="text-lg font-bold text-green-900">นำเข้าเสร็จแล้ว</h2>
          <p className="text-sm text-green-900">เพิ่มใหม่ {done.created} · อัปเดต {done.updated} · ไม่เปลี่ยน {done.unchanged} · ไม่สำเร็จ {done.failed.length} · สร้างบัญชี {done.credentials.length}</p>
          {done.failed.length > 0 && <ul className="list-disc pl-5 text-sm text-red-700">{done.failed.slice(0, 10).map((f) => <li key={f.code}>{f.code}: {f.error}</li>)}</ul>}
          {done.credentials.length > 0 && (
            <div className="space-y-2 rounded-lg bg-white p-4">
              <p className="text-sm"><strong>รหัสผ่านชั่วคราวของ {done.credentials.length} บัญชี</strong> แสดงได้ครั้งเดียว — ดาวน์โหลดเก็บไว้ก่อนปิดหน้านี้ (ในระบบเก็บเฉพาะค่าเข้ารหัส ดูย้อนหลังไม่ได้ แต่ออกรหัสใหม่ให้รายโรงเรียนได้) โรงเรียนต้องตั้งรหัสผ่านใหม่ตอนเข้าสู่ระบบครั้งแรก</p>
              <button onClick={downloadCredentials} className="min-h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-white">ดาวน์โหลดรหัสผ่านชั่วคราว (.csv)</button>
              <p className="text-xs text-amber-700">ไฟล์นี้เป็นความลับ — ส่งให้โรงเรียนแต่ละแห่งเฉพาะของตัวเอง และลบไฟล์เมื่อแจกเสร็จ</p>
            </div>
          )}
          <CardJob missing={1} />
          <Link href="/admin/schools" className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 bg-white px-5 text-sm">ไปที่รายการโรงเรียน</Link>
        </section>
      )}
    </div>
  );
}
