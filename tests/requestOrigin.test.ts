import { describe, expect, test } from "vitest";
import { requestOrigin } from "@/lib/requestOrigin";

/**
 * The regression these guard is a deployed site sending visitors to
 * `http://localhost:3000/login`. `next-auth`'s `auth()` wrapper overwrites the
 * request origin with `AUTH_URL`/`NEXTAUTH_URL` before middleware sees it, so
 * a production environment still holding the development value of that variable
 * poisoned every redirect. Deriving the origin from the forwarded headers is
 * what puts it out of reach — these tests exist to keep it there.
 */

/** A `Headers`-shaped reader over a plain record, matching its null-on-miss. */
const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe("requestOrigin", () => {
  test("uses the forwarded host a platform sets, not the app's own config", () => {
    // Arrange — what Vercel sends for a request to the deployed domain.
    const request = headers({
      "x-forwarded-host": "taskflow.example.com",
      "x-forwarded-proto": "https",
      host: "taskflow.example.com",
    });

    // Act
    const origin = requestOrigin(request);

    // Assert
    expect(origin).toBe("https://taskflow.example.com");
  });

  test("prefers x-forwarded-host over the host the proxy rewrote", () => {
    const origin = requestOrigin(
      headers({
        "x-forwarded-host": "taskflow.example.com",
        "x-forwarded-proto": "https",
        host: "internal-upstream.local",
      })
    );

    expect(origin).toBe("https://taskflow.example.com");
  });

  test("falls back to host when nothing is forwarded", () => {
    const origin = requestOrigin(headers({ host: "taskflow.example.com" }));

    expect(origin).toBe("https://taskflow.example.com");
  });

  test("keeps a non-default port", () => {
    const origin = requestOrigin(headers({ host: "staging.example.com:8443" }));

    expect(origin).toBe("https://staging.example.com:8443");
  });

  test("honours a forwarded protocol that is not https", () => {
    const origin = requestOrigin(
      headers({ "x-forwarded-host": "example.com", "x-forwarded-proto": "http" })
    );

    expect(origin).toBe("http://example.com");
  });

  test("assumes https for a public host, so a redirect never downgrades", () => {
    const origin = requestOrigin(headers({ host: "taskflow.example.com" }));

    expect(origin).toBe("https://taskflow.example.com");
  });

  test.each([
    ["localhost:3000", "http://localhost:3000"],
    ["127.0.0.1:3100", "http://127.0.0.1:3100"],
    ["[::1]:3000", "http://[::1]:3000"],
    ["LOCALHOST:3000", "http://LOCALHOST:3000"],
  ])("serves %s over http so local development still works", (host, expected) => {
    expect(requestOrigin(headers({ host }))).toBe(expected);
  });

  test("takes the client-nearest entry when a proxy chain appends", () => {
    // Two proxies in front: `client, edge`. The left-most is the real one.
    const origin = requestOrigin(
      headers({
        "x-forwarded-host": "taskflow.example.com, edge.internal",
        "x-forwarded-proto": "https, http",
      })
    );

    expect(origin).toBe("https://taskflow.example.com");
  });

  test("ignores an empty forwarded host rather than building '://'", () => {
    const origin = requestOrigin(
      headers({ "x-forwarded-host": "", host: "taskflow.example.com" })
    );

    expect(origin).toBe("https://taskflow.example.com");
  });

  test("returns null with no host at all, leaving the caller its fallback", () => {
    expect(requestOrigin(headers({}))).toBeNull();
  });

  test("builds a login redirect on the requested host, not on NEXTAUTH_URL", () => {
    /*
     * The end-to-end shape of the bug: the env var says localhost, the request
     * arrived on the deployed domain, and the redirect must follow the request.
     */
    const request = headers({
      "x-forwarded-host": "taskflow.example.com",
      "x-forwarded-proto": "https",
    });

    const loginUrl = new URL("/login", requestOrigin(request) ?? "http://localhost:3000");
    loginUrl.searchParams.set("callbackUrl", "/wallet");

    expect(loginUrl.href).toBe(
      "https://taskflow.example.com/login?callbackUrl=%2Fwallet"
    );
    expect(loginUrl.href).not.toContain("localhost");
  });
});
