"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/login" })} className="min-h-10 rounded-full bg-white/15 px-5 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/25">
      ออกจากระบบ
    </button>
  );
}
