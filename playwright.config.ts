import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * The suite is split in two:
 *
 *   - `public`  — runs anywhere. Route protection, security headers, and the
 *                 unauthenticated pages, none of which need seeded data.
 *   - `journey` — the signed-in flow. Needs `E2E_EMAIL` / `E2E_PASSWORD` for a
 *                 verified account in the target database, so it is skipped
 *                 rather than failed when those are absent.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  /*
   * Assertions that wait on a database-backed response have to tolerate the
   * first request paying for connection setup — against a remote cluster
   * that can exceed the 5s default, and whichever test happens to run first
   * is the one that pays it.
   */
  expect: { timeout: 15_000 },
  timeout: 45_000,

  use: {
    baseURL,
    // Artifacts only for failures — a green run should not produce 200 MB of video.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "public",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "journey",
      testMatch: /journey\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Reuses an already-running dev server locally; starts one in CI.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "ignore",
        env: {
          // Must match the port Playwright actually drives, or Auth.js builds
          // its callback URLs against the wrong origin.
          //
          // Nothing else is set here on purpose: Next loads `.env.local` itself
          // and will not override an already-set variable, so passing
          // MONGODB_URI through would shadow the real one and leave every
          // database-backed request hanging until the selection timeout.
          NEXTAUTH_URL: baseURL,
        },
      },
});
