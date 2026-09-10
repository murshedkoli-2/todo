/**
 * Derives the origin a request actually arrived on, from its headers alone.
 *
 * Middleware cannot trust `request.nextUrl` for this. `next-auth`'s `auth()`
 * wrapper rewrites the request's origin to whatever `AUTH_URL`/`NEXTAUTH_URL`
 * names before the handler runs — see `next-auth/lib/env.js#reqWithEnvURL`,
 * called from `handleAuth` — and it does so whether or not `trustHost` is set.
 * A deployment still carrying the development value of that variable therefore
 * redirected every signed-out visitor to `http://localhost:3000/login`.
 *
 * The forwarded headers are out of that variable's reach, so reading them keeps
 * redirects on the host the browser asked for.
 *
 * On the trust question: the host header is client-controlled in general, but
 * this is the same source Next uses for `nextUrl` when no env override exists,
 * which is what `trustHost: true` already opts into. The platform terminating
 * TLS sets `x-forwarded-host` itself, and it is preferred here for that reason.
 * Callers must still only build same-site paths from this — never a redirect
 * target taken from user input.
 */

/** Loopback authorities, which are the only ones served over plain http. */
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Proxies may append rather than replace, producing `a.example, b.example`.
 * The left-most entry is the one nearest the client, and the only one a single
 * trusted proxy will have written.
 */
function firstValue(header: string | null): string | null {
  if (header === null) return null;
  const first = header.split(",")[0].trim();
  return first === "" ? null : first;
}

function isLoopback(host: string): boolean {
  const authority = host.toLowerCase();
  return LOOPBACK_HOSTS.some(
    (loopback) => authority === loopback || authority.startsWith(`${loopback}:`)
  );
}

/** The subset of `Headers` this needs, so tests need not build a real request. */
export interface HeaderReader {
  get(name: string): string | null;
}

/**
 * The request's own origin (`https://host[:port]`), or `null` when no host
 * header is present at all — in which case the caller should fall back to the
 * URL it already has rather than invent one.
 */
export function requestOrigin(headers: HeaderReader): string | null {
  const host =
    firstValue(headers.get("x-forwarded-host")) ??
    firstValue(headers.get("host"));
  if (host === null) return null;

  // Absent an explicit protocol, only loopback is assumed to be unencrypted.
  const proto =
    firstValue(headers.get("x-forwarded-proto")) ??
    (isLoopback(host) ? "http" : "https");

  return `${proto}://${host}`;
}
