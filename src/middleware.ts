import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, isPublicRoute } from "@/auth.config";
import { THEME_SCRIPT } from "@/lib/themeScript";

const { auth } = NextAuth(authConfig);

/**
 * `'sha256-…'` source expression for the inline theme script.
 *
 * Computed once per worker from the shared constant, so editing the script
 * cannot leave a stale hash behind. A hash rather than a nonce because React
 * hydrates that element and browsers blank the nonce attribute after applying
 * CSP, which would make the prop mismatch on every load.
 */
let cachedScriptHash: string | null = null;

async function themeScriptHash(): Promise<string> {
  if (cachedScriptHash) return cachedScriptHash;

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(THEME_SCRIPT)
  );
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  cachedScriptHash = `'sha256-${base64}'`;
  return cachedScriptHash;
}

/**
 * Builds a per-request Content-Security-Policy.
 *
 * `script-src` combines two mechanisms: a nonce, which Next injects into its
 * own bootstrap scripts when it sees one in this header, and a hash covering
 * the app's single inline script. `strict-dynamic` lets the nonced bootstrap
 * load its chunks without enumerating every URL.
 *
 * `style-src` keeps `'unsafe-inline'`. The app renders token-driven `style`
 * attributes server-side, which neither a nonce nor a hash can cover (both
 * apply to elements, not attributes); style injection is also a far weaker
 * primitive than script injection, so this is the standard trade, not a gap.
 */
function contentSecurityPolicy(
  nonce: string,
  scriptHash: string,
  isDevelopment: boolean
): string {
  const scriptSrc = isDevelopment
    ? // Dev needs eval for React Refresh; production never does.
      `'self' 'nonce-${nonce}' ${scriptHash} 'unsafe-eval' 'unsafe-inline'`
    : `'self' 'nonce-${nonce}' ${scriptHash} 'strict-dynamic'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    // ImgBB serves task attachments; `data:` covers inline placeholders.
    "img-src 'self' data: blob: https://i.ibb.co https://*.ibb.co",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export default auth(async (request) => {
  const { pathname } = request.nextUrl;
  const isSignedIn = Boolean(request.auth?.user?.id);
  const isApiRoute = pathname.startsWith("/api");

  /* ── Route protection ───────────────────────────────────────────────────
     Previously every page and route re-implemented this check. Centralising
     it means a new page is protected by default rather than by remembering. */
  if (!isSignedIn && !isPublicRoute(pathname) && !isApiRoute) {
    const loginUrl = new URL("/login", request.nextUrl);
    // Preserve the destination so login can return the user to it.
    if (pathname !== "/") loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // A signed-in user on an auth page has nothing to do there.
  if (isSignedIn && isPublicRoute(pathname)) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const isDevelopment = process.env.NODE_ENV === "development";
  const csp = contentSecurityPolicy(nonce, await themeScriptHash(), isDevelopment);

  // Next reads the nonce out of this request header to stamp its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
});

export const config = {
  /*
   * Everything except Next's own static output and public assets. The auth
   * routes are excluded so the NextAuth handler is never redirected by its own
   * middleware, which would break the sign-in POST.
   */
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.png|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2)$).*)",
  ],
};
