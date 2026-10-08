import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type AppRole = "ADMIN" | "LIBRARIAN" | "TEACHER" | "STUDENT";

/** Publish / pin / delete anything: admins only. */
export const isAdmin = (role?: string) => role === "ADMIN";
/** Back-office managers: site settings, ordering, editing everyone's slides. */
export const isManager = (role?: string) => role === "ADMIN" || role === "LIBRARIAN";
/** May create slides/lessons (they stay unpublished until an admin approves). */
export const canAuthor = (role?: string) => isManager(role) || role === "TEACHER";

/** For server actions: throws unless the signed-in user has one of the roles. */
export async function assertRole(check: (role: string) => boolean) {
  const session = await getServerSession(authOptions);
  if (!session || !check(session.user.role)) throw new Error("Forbidden");
  return session.user;
}

/** For admin pages that teachers must not see (settings, users, ...). */
export async function requireManagerPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isManager(session.user.role)) redirect(canAuthor(session.user.role) ? "/admin/banners" : "/dashboard");
  return session.user;
}
