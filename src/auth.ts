import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 365 * 24 * 60 * 60, // 365 days (keep logged in)
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "PIN",
      credentials: {
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        const expectedPin = process.env.AUTH_PIN || "2580";
        const inputPin = credentials?.pin as string;

        if (!inputPin) {
          throw new Error("PIN is required");
        }

        if (inputPin !== expectedPin) {
          throw new Error("Invalid PIN");
        }

        // Return a default admin/user session
        return {
          id: "admin",
          name: "Admin",
          email: "admin@example.com",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
