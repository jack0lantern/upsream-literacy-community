import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          include: { district: true },
        });

        if (!user) return null;
        if (user.status === "suspended") return null;
        if (user.status === "deactivated") return null;

        const passwordValid = await compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!passwordValid) return null;

        await db.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          onboarded: user.onboarded,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
        token.onboarded = (user as { onboarded?: boolean }).onboarded ?? false;
        token.emailVerified =
          (user as { emailVerified?: boolean }).emailVerified ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { isAdmin?: boolean }).isAdmin =
          token.isAdmin as boolean;
        (session.user as { onboarded?: boolean }).onboarded =
          token.onboarded as boolean;
        (session.user as { emailVerified?: boolean }).emailVerified =
          token.emailVerified as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
