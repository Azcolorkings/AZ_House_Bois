import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail, getUserById } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const user = await getUserByEmail(email);
        if (!user) return null;
        // Suspended accounts cannot sign in. The session callback below
        // blocks their existing sessions too, so this is a full lockout.
        if (user.suspended) return null;
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          subscriptionStatus: user.subscription_status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role;
        token.subscriptionStatus = (user as { subscriptionStatus?: string })
          .subscriptionStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { subscriptionStatus?: string }).subscriptionStatus =
          token.subscriptionStatus as string;
        // A user suspended while holding a live JWT loses access on the
        // very next session check — every page and API route calls auth(),
        // so this is the one choke point. A DB failure here must never
        // lock everyone out, so it fails open; sign-in still blocks.
        try {
          const fresh = token.id
            ? await getUserById(String(token.id))
            : null;
          if (fresh?.suspended) {
            return { ...session, user: undefined } as unknown as typeof session;
          }
        } catch {
          // Fall through with the session intact.
        }
      }
      return session;
    },
  },
});
