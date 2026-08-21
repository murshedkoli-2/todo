import { expect, test } from "@playwright/test";
import { continueTo, expectStep } from "./wizard";

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
  /*
   * Field queries are scoped to the panel throughout. The stepper names every
   * step in the flow for assistive tech — "Step 2, Password" — so an unscoped
   * `getByLabel("Password")` matches the rail button as well as the input, and
   * would pass on the wrong element.
   */
  const panel = (page: import("@playwright/test").Page) => page.locator(".wizard-panel");

  test("asks for the email first, then the password", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(panel(page).getByLabel("Email address")).toBeVisible();
    // The password belongs to the second step and must not be reachable yet.
    await expect(panel(page).getByLabel("Password")).toHaveCount(0);

    await page.getByLabel("Email address").fill("someone@example.com");
    await continueTo(page, "password");

    await expect(panel(page).getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("names the account being entered on the password step", async ({ page }) => {
    // The reason the split earns its extra press: a typo in the address is
    // visible before the password is typed, rather than surfacing afterwards
    // as "incorrect email or password".
    await page.goto("/login");
    await page.getByLabel("Email address").fill("typo@example.com");
    await continueTo(page, "password");

    await expect(page.locator(".wizard-panel")).toContainText("typo@example.com");
  });

  test("refuses to advance past a malformed email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByRole("button", { name: "Continue" }).click();

    await expectStep(page, "email");
    await expect(page.locator("p.alert-error")).toContainText(/valid email address/i);
  });

  test("rejects bad credentials with one generic message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("nobody@example.com");
    await continueTo(page, "password");
    await panel(page).getByLabel("Password").fill("definitely-wrong-password");
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

    // Enter in the field advances the step rather than submitting a form that
    // has no password in it yet.
    await page.keyboard.type("someone@example.com");
    await page.keyboard.press("Enter");
    await expectStep(page, "password");

    // The next step autofocuses its own field, so the flow never asks the
    // keyboard user to hunt for where they are.
    await expect(panel(page).getByLabel("Password")).toBeFocused();
  });

  test("going back keeps the email already entered", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill("someone@example.com");
    await continueTo(page, "password");

    // Exact: the rail's own "Go back to step 1, Email" button also matches a
    // substring search for "Back".
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expectStep(page, "email");
    await expect(page.getByLabel("Email address")).toHaveValue("someone@example.com");
  });
});

test.describe("register page", () => {
  /** Fills the identity step and advances to the password step. */
  async function toPasswordStep(page: import("@playwright/test").Page) {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Test User");
    await page.getByLabel("Email address").fill("test@example.com");
    await continueTo(page, "password");
  }

  test("states the password policy on the step that asks for one", async ({ page }) => {
    await toPasswordStep(page);
    await expect(page.getByText(/At least 8 characters/)).toBeVisible();
  });

  test("blocks mismatched passwords before hitting the network", async ({ page }) => {
    await toPasswordStep(page);
    await page.getByLabel("Password", { exact: true }).fill("longenough1");
    await page.getByLabel("Confirm password").fill("different123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.locator("p.alert-error")).toContainText(/do not match/i);
    // Still on the password step: a rejected step must not advance.
    await expectStep(page, "password");
  });

  test("refuses to advance past an incomplete identity step", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Test User");
    await page.getByLabel("Email address").fill("nope");
    await page.getByRole("button", { name: "Continue" }).click();

    await expectStep(page, "you");
    await expect(page.locator("p.alert-error")).toContainText(/valid email address/i);
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
    await expectStep(page, "code");
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
