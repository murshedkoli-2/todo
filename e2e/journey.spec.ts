import { expect, test, type Page } from "@playwright/test";

/**
 * The signed-in journey: task → ledger → wallet.
 *
 * Needs a verified account in the target database. Rather than seeding one
 * (which would mean bypassing the OTP flow the app deliberately enforces), the
 * credentials come from the environment and the suite skips when they are
 * absent — a skipped suite is honest, a suite that fails for want of a fixture
 * trains people to ignore red.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(
  !EMAIL || !PASSWORD,
  "Set E2E_EMAIL and E2E_PASSWORD to a verified account to run the signed-in journey."
);

/** Names are timestamped so parallel runs and reruns never collide. */
const stamp = () => Date.now().toString(36);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("creates, edits, and deletes a task", async ({ page }) => {
  const title = `E2E task ${stamp()}`;

  await page.getByRole("link", { name: "Create a new task" }).click();
  await expect(page).toHaveURL(/\/tasks\/new/);

  await page.getByLabel("Title").fill(title);
  await page.getByLabel(/Description/).fill("Created by the end-to-end suite.");
  await page.getByLabel(/^Amount/).fill("1234.56");
  await page.getByRole("button", { name: "Create task" }).click();

  await expect(page).toHaveURL(/\/$/);
  const card = page.getByRole("article", { name: title });
  await expect(card).toBeVisible();

  // The amount must render through the shared money formatter, not raw.
  await expect(card).toContainText("৳1,234.56");

  await card.getByRole("button", { name: `Edit ${title}` }).click();
  await page.getByLabel("Title").fill(`${title} (edited)`);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("article", { name: `${title} (edited)` })).toBeVisible();

  await page
    .getByRole("article", { name: `${title} (edited)` })
    .getByRole("button", { name: /^Edit/ })
    .click();
  await page.getByRole("button", { name: "Delete task" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();

  await expect(page.getByRole("article", { name: `${title} (edited)` })).toBeHidden();
});

test("moves a task between board columns", async ({ page }) => {
  const title = `E2E board ${stamp()}`;

  await page.goto("/tasks/new");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("radio", { name: "Board" }).click();

  // The <select> is the keyboard and touch path; drag-and-drop is the shortcut,
  // not the only way through.
  const card = page.locator("article", { hasText: title }).first();
  await card.getByRole("combobox").selectOption("in_progress");

  const inProgressColumn = page.getByRole("region", { name: /In Progress/ });
  await expect(inProgressColumn).toContainText(title);
});

test("records a ledger entry and updates the net position", async ({ page }) => {
  const name = `E2E person ${stamp()}`;

  await page.goto("/ledger");
  await page.getByRole("button", { name: "Add person" }).click();
  await page.getByLabel(/^Name/).fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Add person" }).click();

  const row = page.getByRole("button", { name: new RegExp(name) });
  await expect(row).toBeVisible();

  await row.click();
  await page.getByRole("dialog").getByLabel("Amount").fill("500");
  await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();

  // Running balance is computed at read time from the ordered ledger.
  await expect(page.getByRole("dialog")).toContainText("+৳500.00");

  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(row).toContainText("+৳500.00");
});

test("keeps a wallet balance consistent with its transactions", async ({ page }) => {
  const name = `E2E account ${stamp()}`;

  await page.goto("/wallet");
  await page.getByRole("button", { name: "Add account" }).click();
  await page.getByLabel("Account name").fill(name);
  await page.getByLabel("Current balance").fill("1000");
  await page.getByRole("dialog").getByRole("button", { name: "Add account" }).click();

  const row = page.getByRole("button", { name: new RegExp(name) });
  await expect(row).toContainText("৳1,000.00");

  await row.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Money out" }).click();
  await dialog.getByLabel("Amount").fill("250.50");
  await dialog.getByRole("button", { name: "Add" }).click();

  // 1000 − 250.50; the assertion fails on any float-drift regression.
  await expect(dialog).toContainText("৳749.50");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(row).toContainText("৳749.50");
});

test("opens the command palette and navigates with it", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+k");

  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();

  await palette.getByRole("textbox").fill("wallet");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/wallet/);
});

test("restores focus to the trigger when a dialog closes", async ({ page }) => {
  await page.goto("/ledger");

  const trigger = page.getByRole("button", { name: "Add person" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  // Losing focus to <body> on close is the classic keyboard-trap symptom.
  await expect(trigger).toBeFocused();
});
