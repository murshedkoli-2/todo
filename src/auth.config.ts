import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the NextAuth configuration.
 *
 * `middleware.ts` runs on the Edge runtime, which cannot load Mongoose. Keeping
 * the providers (and therefore the database) out of this file lets the
 * middleware read and validate the session JWT while the full config in
 * `auth.ts` layers the Credentials provider on top for the Node runtime.
 */

/** Routes reachable without a session. Everything else requires one. */
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password"];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export const authConfig = {
  /**
   * Auth.js v5 rejects any request whose Host header does not match
   * `NEXTAUTH_URL`, which breaks every deployment that is not served on exactly
   * that origin — preview URLs, a proxy, a non-default port. The app runs
   * behind a platform that terminates TLS and sets Host itself (Vercel), so
   * the header is trustworthy here.
   *
   * If this is ever self-hosted with a proxy that does not overwrite Host,
   * set `NEXTAUTH_URL` and drop this flag.
   */
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // Populated in `auth.ts`; empty here so this stays importable from the edge.
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      if (token?.email) session.user.email = token.email as string;
      if (token?.name) session.user.name = token.name as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
