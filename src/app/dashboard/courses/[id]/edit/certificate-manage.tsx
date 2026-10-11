"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createDesignAction, issueNumbersAction, restoreCertificateAction, revokeCertificateAction } from "./certificate-actions";

const btn = "flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold disabled:opacity-50";

export function NewDesignForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const r = await createDesignAction(courseId, name);
          if (r.ok) router.push(`/dashboard/courses/${courseId}/edit?tab=certificate&design=${r.id}`);
          else setError(r.error);
        });
      }}
      className="space-y-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="ชื่อแบบ เช่น ผ่านการอบรม" aria-label="ชื่อแบบเกียรติบัตรใหม่" className="min-h-11 w-full rounded-lg border border-neutral-300 px-3" />
        <button disabled={pending || !name.trim()} className={`${btn} shrink-0 bg-brand text-white hover:bg-brand-dark`}>+ เพิ่มแบบเกียรติบัตร</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export function IssuePanel({ courseId, waiting, finishedWithoutRow }: { courseId: string; waiting: number; finishedWithoutRow: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const count = waiting + finishedWithoutRow;
  return (
    <div className="space-y-2 rounded-xl bg-amber-50 p-4">
      <p className="text-sm text-amber-900">มีผู้เรียนรอออกเลข <strong>{count.toLocaleString("th-TH")}</strong> คน — เมื่อกดแล้วระบบจะออกเลขเรียงตามวันที่เรียนจบ (คนจบก่อนได้เลขก่อน) และผู้เรียนจะดาวน์โหลดได้ทันที</p>
      <button
        type="button"
        disabled={pending || count === 0}
        onClick={() => {
          if (!confirm(`ออกเลขเกียรติบัตรให้ ${count} คน? เลขที่ออกแล้วใช้ซ้ำไม่ได้`)) return;
          setMsg(null);
          start(async () => {
            const r = await issueNumbersAction(courseId);
            if (r.ok) { setMsg({ ok: true, text: `ออกเลขแล้ว ${r.issued} คน` }); router.refresh(); } else setMsg({ ok: false, text: r.error });
          });
        }}
        className={`${btn} bg-brand text-white hover:bg-brand-dark`}
      >{pending ? "กำลังออกเลข…" : "ออกเลขให้ผู้ที่รอทั้งหมด"}</button>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm font-medium ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}

export function RowActions({ courseId, id, status }: { courseId: string; id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { setError(""); router.refresh(); } else setError(r.error ?? "ทำรายการไม่สำเร็จ");
    });
  return (
    <div className="flex flex-col items-end gap-1">
      {status === "REVOKED" ? (
        <button type="button" disabled={pending} onClick={() => run(() => restoreCertificateAction(courseId, id))} className="min-h-9 rounded-lg border border-neutral-300 px-3 text-xs font-semibold hover:border-brand">คืนสถานะ</button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const note = prompt("เหตุผลที่เพิกถอนเกียรติบัตรนี้ (อย่างน้อย 5 ตัวอักษร)");
            if (note !== null) run(() => revokeCertificateAction(courseId, id, note));
          }}
          className="min-h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
        >เพิกถอน</button>
      )}
      {error && <span role="alert" className="max-w-48 text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}
