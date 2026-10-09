import type { NextAuthOptions } from "next-auth";
import { encode } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().trim().min(3).max(120), // e-mail or username
  password: z.string().min(8),
});

export const authOptions: NextAuthOptions = {
  // Cookie lives up to 30 days; the token itself expires after 1 day unless "remember me" was ticked.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  jwt: {
    encode: (params) => encode({ ...params, maxAge: params.token?.remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60 }),
  },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email or username",
      credentials: {
        email: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember", type: "text" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const id = parsed.data.email.toLowerCase();
        const user = await db.user.findUnique({ where: id.includes("@") ? { email: id } : { username: id } });
        if (!user || !user.active) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email ?? undefined, name: user.name, role: user.role, remember: raw?.remember === "true", mustChange: user.mustChangePassword };
      },
    }),
    // ---- DEV-ONLY shortcut (remove before go-live) --------------------------------------------
    // One-click sign-in as the first active user of a role. Only registered when NODE_ENV is
    // "development" (npm run dev), so it does not exist in `next build` / on Vercel.
    ...(process.env.NODE_ENV === "development"
      ? [
          CredentialsProvider({
            id: "dev-quick-login",
            name: "Dev quick login",
            credentials: { role: { label: "Role", type: "text" } },
            async authorize(raw) {
              const role = z.enum(["ADMIN", "LIBRARIAN", "TEACHER", "STUDENT"]).safeParse(raw?.role);
              if (!role.success) return null;
              const user = await db.user.findFirst({ where: { role: role.data, active: true }, orderBy: { createdAt: "asc" } });
              if (!user) return null;
              return { id: user.id, email: user.email ?? undefined, name: user.name, role: user.role, remember: true };
            },
          }),
        ]
      : []),
    // ---- end DEV-ONLY ---------------------------------------------------------------------------
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.remember = user.remember;
        token.mustChange = user.mustChange ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as typeof session.user.role;
        session.user.mustChange = !!token.mustChange;
      }
      return session;
    },
  },
};
