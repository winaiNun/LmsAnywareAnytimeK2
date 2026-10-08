"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/login" })} className="rounded border px-3 py-1">
      ออกจากระบบ
    </button>
  );
}
