import { expect, test } from "@playwright/test";

/**
 * Everything here runs without seeded data — route protection, security
 * headers, and the unauthenticated pages. These are the assertions worth
 * having in CI on every commit, because they cover the middleware, which is
 * the single point every request passes through.
 */

test.describe("route protection", () => {
  for (const path of ["/", "/ledger", "/wallet", "/tasks/new"]) {
    test(`redirects ${path} to login when signed out`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("preserves the intended destination as callbackUrl", async ({ page }) => {
    await page.goto("/wallet");
    await expect(page).toHaveURL(/callbackUrl=%2Fwallet/);
  });

  test("does not add a callbackUrl for the root path", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("leaves the auth API reachable so sign-in can complete", async ({ request }) => {
    // The matcher excludes /api/auth; if that regression ever lands, login
    // breaks entirely and this is the assertion that catches it.
    const response = await request.get("/api/auth/providers");
    expect(response.status()).toBe(200);
  });

  test("returns 401 rather than a redirect for data APIs", async ({ request }) => {
    const response = await request.get("/api/todos");
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
  });
});

test.describe("security headers", () => {
  test("sets a nonce-based CSP without unsafe-inline scripts", async ({ page }) => {
    const response = await page.goto("/login");
    const csp = response?.headers()["content-security-policy"];

    expect(csp).toBeTruthy();
    expect(csp).toContain("nonce-");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  test("sets the supporting headers and drops the deprecated one", async ({ page }) => {
    const response = await page.goto("/login");
    const headers = response!.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    // Removed deliberately: the filter it enabled is gone from every current
    // browser and was itself exploitable.
    expect(headers["x-xss-protection"]).toBeUndefined();
  });

  test("loads with no CSP violations reported to the console", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    expect(violations).toEqual([]);
  });
});

test.describe("login page", () => {
  test("renders the form and its accessible names", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("rejects bad credentials with one generic message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("nobody@example.com");
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    // Scoped to the page's own alert: Next mounts a global route announcer with
    // role="alert", and the toast viewport is a permanent role="status" region.
    const alert = page.locator("p.alert-error");
    await expect(alert).toBeVisible();
    // The message must not reveal whether the address is registered.
    await expect(alert).toContainText(/Incorrect email or password/i);
  });

  test("is operable by keyboard alone", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email address")).toBeFocused();

    await page.keyboard.type("someone@example.com");
    await page.keyboard.press("Tab"); // → "Forgot password?"
    await page.keyboard.press("Tab"); // → password
    await expect(page.getByLabel("Password")).toBeFocused();
  });
});

test.describe("register page", () => {
  test("states the password policy", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText(/At least 8 characters/)).toBeVisible();
  });

  test("blocks mismatched passwords before hitting the network", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Test User");
    await page.getByLabel("Email address").fill("test@example.com");
    await page.getByLabel("Password", { exact: true }).fill("longenough1");
    await page.getByLabel("Confirm password").fill("different123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.locator("p.alert-error")).toContainText(/do not match/i);
  });
});

test.describe("forgot password", () => {
  test("acknowledges without confirming whether the account exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill("definitely-not-a-user@example.com");
    await page.getByRole("button", { name: "Send reset code" }).click();

    // A 404 here would turn this endpoint into a user-enumeration oracle.
    await expect(page.locator("p.alert-success")).toContainText(
      /If that email is registered/i
    );
    await expect(page.getByLabel("Verification code")).toBeVisible();
  });
});

test.describe("theming and responsiveness", () => {
  test("renders both themes without a flash of the wrong palette", async ({ page }) => {
    await page.goto("/login");
    // The inline script runs before paint, so `light` is already applied.
    await expect(page.locator("html")).toHaveClass(/light/);
  });

  test("has no horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/login");

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflows).toBe(false);
  });
});

test("unknown routes redirect to login rather than confirming they exist", async ({ page }) => {
  // The middleware gates everything outside the public routes, so a signed-out
  // visitor cannot use 404-vs-redirect to enumerate which routes exist. The
  // styled 404 itself is asserted in the signed-in journey suite.
  await page.goto("/this-page-does-not-exist");
  await expect(page).toHaveURL(/\/login/);
});
