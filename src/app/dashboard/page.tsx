import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import SignOutButton from "./sign-out-button";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">แดชบอร์ด</h1>
      <p>
        สวัสดี {session?.user.name} ({session?.user.role})
      </p>
      <div className="flex flex-wrap gap-3">
        {["ADMIN", "LIBRARIAN"].includes(session?.user.role ?? "") && (
          <Link href="/admin" className="flex min-h-10 items-center rounded bg-brand px-4 font-semibold text-white">ไปหลังบ้าน</Link>
        )}
        <Link href="/" className="flex min-h-10 items-center rounded border px-4">หน้าแรก</Link>
        <SignOutButton />
      </div>
    </main>
  );
}
