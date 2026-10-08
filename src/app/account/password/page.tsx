import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PasswordForm from "./password-form";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/account/password");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold">เปลี่ยนรหัสผ่าน</h1>
        <p className="text-sm text-neutral-600">บัญชี {session.user.email}</p>
      </div>
      <PasswordForm forced={!!session.user.mustChange} />
    </main>
  );
}
