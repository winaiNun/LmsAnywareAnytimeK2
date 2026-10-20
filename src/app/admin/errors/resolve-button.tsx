"use client";

import { useState, useTransition } from "react";
import { setErrorResolved } from "./actions";

export default function ResolveButton({ id, resolved }: { id: string; resolved: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { const r = await setErrorResolved(id, !resolved); setError(r.error ?? ""); })}
        className={`min-h-9 whitespace-nowrap rounded-lg border px-3 text-xs disabled:opacity-50 ${resolved ? "border-neutral-300" : "border-green-300 text-green-700"}`}
      >
        {resolved ? "เปิดอีกครั้ง" : "แก้แล้ว"}
      </button>
      {error && <span role="alert" className="ml-1 text-xs text-red-600">{error}</span>}
    </>
  );
}
