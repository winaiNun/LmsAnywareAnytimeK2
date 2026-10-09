import type { NextAuthOptions } from "next-auth";
import { encode } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { PIN_MAX_FAILS, hashToken, pinAllowed } from "@/lib/pin";

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
    // Quick sign-in on a phone that was set up before: device token (kept on the phone) + 6-digit PIN.
    // Five wrong PINs delete the device, so guessing is capped at 5 tries per phone; the token is unguessable.
    CredentialsProvider({
      id: "pin",
      name: "PIN",
      credentials: { token: { label: "Device", type: "text" }, pin: { label: "PIN", type: "password" } },
      async authorize(raw) {
        const token = String(raw?.token ?? "");
        const pin = String(raw?.pin ?? "");
        if (!/^[0-9a-f]{64}$/.test(token) || !/^\d{6}$/.test(pin)) return null;
        const device = await db.trustedDevice.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
        if (!device) return null;
        const user = device.user;
        if (!user.active || !pinAllowed(user.role)) return null;

        if (!(await bcrypt.compare(pin, device.pinHash))) {
          if (device.failCount + 1 >= PIN_MAX_FAILS) await db.trustedDevice.delete({ where: { id: device.id } });
          else await db.trustedDevice.update({ where: { id: device.id }, data: { failCount: { increment: 1 } } });
          return null;
        }
        await db.trustedDevice.update({ where: { id: device.id }, data: { failCount: 0, lastUsedAt: new Date() } });
        return { id: user.id, email: user.email ?? undefined, name: user.name, role: user.role, remember: true, mustChange: user.mustChangePassword };
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
