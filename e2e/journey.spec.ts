import { expect, test, type Page } from "@playwright/test";
import { continueTo, continueThrough, expectStep } from "./wizard";

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
  await continueTo(page, "password");
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/**
 * Walks the task wizard from the details step to the review step, filling
 * whatever the caller supplies along the way. Every step but the first is
 * optional, so this is also the shortest path to a saved task.
 */
async function fillTaskWizard(
  page: Page,
  fields: { title?: string; description?: string; total?: string; paid?: string; method?: string }
) {
  await expectStep(page, "details");
  if (fields.title !== undefined) await page.getByLabel("Title").fill(fields.title);
  if (fields.description !== undefined) await page.getByLabel(/Description/).fill(fields.description);

  await continueThrough(page, "schedule", "payment");
  if (fields.total !== undefined) await page.getByLabel(/^Total cost/).fill(fields.total);
  if (fields.paid !== undefined) await page.getByLabel(/^Paid so far/).fill(fields.paid);
  if (fields.method !== undefined) await page.getByRole("radio", { name: fields.method }).click();
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("creates, edits, and deletes a task", async ({ page }) => {
  const title = `E2E task ${stamp()}`;

  await page.getByRole("link", { name: "Create a new task" }).click();
  await expect(page).toHaveURL(/\/tasks\/new/);

  await fillTaskWizard(page, {
    title,
    description: "Created by the end-to-end suite.",
    total: "1234.56",
  });
  await continueThrough(page, "attachments", "review");

  // The review step restores the overview the split gave up: everything
  // entered across four screens, before anything is written.
  const review = page.locator(".wizard-panel[data-step='review']");
  await expect(review).toContainText(title);
  await expect(review).toContainText("৳1,234.56");

  await page.getByRole("button", { name: "Create task" }).click();

  await expect(page).toHaveURL(/\/$/);

  /*
   * Regression guard, and the reason this assertion runs before any reload:
   * the list client used to seed its state from the server payload exactly
   * once, so the refreshed rows that arrive after a create were rendered by
   * the server and then ignored. The task only appeared after a manual reload.
   * If this ever goes back to needing `page.reload()`, that bug is back.
   */

  // The task list defaults to the dense list view; the card-shaped assertions
  // below (cover image, edit button, formatted amount) belong to the grid.
  await page.getByRole("radio", { name: "Grid" }).click();

  const card = page.getByRole("article", { name: title });
  await expect(card).toBeVisible();

  // The amount must render through the shared money formatter, not raw.
  await expect(card).toContainText("৳1,234.56");

  await card.getByRole("button", { name: `Edit ${title}` }).click();
  await expectStep(page, "details");
  await page.getByLabel("Title").fill(`${title} (edited)`);
  await continueThrough(page, "schedule", "payment", "attachments", "review");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("article", { name: `${title} (edited)` })).toBeVisible();

  await page
    .getByRole("article", { name: `${title} (edited)` })
    .getByRole("button", { name: /^Edit/ })
    .click();
  await expectStep(page, "details");
  // Delete sits in the wizard footer on every step, so it never costs a walk
  // to the end of the flow to reach it.
  await page.getByRole("button", { name: "Delete task" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();

  await expect(page.getByRole("article", { name: `${title} (edited)` })).toBeHidden();
});

test("derives due and payment status from the total and what has been paid", async ({ page }) => {
  const title = `E2E payment ${stamp()}`;

  await page.goto("/tasks/new");
  await fillTaskWizard(page, { title, total: "13500", paid: "7500", method: "bKash" });

  // The summary is derived live, before anything is saved. There is no status
  // control to set — 13500 less 7500 is what makes this task part-paid.
  await expect(page.getByText("৳6,000")).toBeVisible();
  await expect(page.getByText("Partial")).toBeVisible();

  await continueThrough(page, "attachments", "review");
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page).toHaveURL(/\/$/);

  // The server derives the same status rather than trusting what was posted.
  await page.getByRole("listitem").filter({ hasText: title })
    .getByRole("button", { name: title }).click();
  await expect(page).toHaveURL(/\/tasks\/[a-f0-9]{24}/);

  await expect(page.getByText("৳13,500")).toBeVisible();
  await expect(page.getByText("৳7,500")).toBeVisible();
  await expect(page.getByText("৳6,000")).toBeVisible();
  await expect(page.getByText("bKash")).toBeVisible();

  // Settling it flips the derived status with no status control involved.
  await page.getByRole("link", { name: "Edit task" }).click();
  await continueThrough(page, "schedule", "payment");
  await page.getByLabel(/^Paid so far/).fill("13500");
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();
  await continueThrough(page, "attachments", "review");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("captures a task from the quick-add bar, parsing date and priority", async ({ page }) => {
  const title = `E2E quick ${stamp()}`;

  const quickAdd = page.getByLabel("Quick add a task");
  await quickAdd.fill(`${title} tomorrow !high`);

  // The preview states what will be created before anything is submitted.
  const preview = page.getByText("Will create");
  await expect(preview).toBeVisible();

  await page.getByRole("button", { name: "Add" }).click();

  // The parsed tokens are stripped from the stored title, not left in it.
  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText("!high");
  await expect(row).toContainText("Tomorrow");
  await expect(row.getByText("High")).toBeAttached();

  // The bar clears on success and is ready for the next capture.
  await expect(quickAdd).toHaveValue("");
});

test("completes a task from the list and undoes it", async ({ page }) => {
  const title = `E2E undo ${stamp()}`;

  await page.getByLabel("Quick add a task").fill(title);
  await page.getByRole("button", { name: "Add" }).click();

  const row = page.getByRole("listitem").filter({ hasText: title });
  await expect(row).toBeVisible();

  await row.getByRole("checkbox").click();
  await expect(row.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");

  // A completed task leaves the default view, and the toast is the only way
  // back from a mis-click — which is exactly what makes it worth testing.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();
});

test("opens the keyboard shortcuts sheet with ?", async ({ page }) => {
  await page.keyboard.press("?");

  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Focus quick add");

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("finds a task through the command palette", async ({ page }) => {
  const title = `E2E palette ${stamp()}`;

  await page.getByLabel("Quick add a task").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();

  await page.keyboard.press("ControlOrMeta+k");
  await page.getByLabel("Search tasks and commands").fill(title);

  await page.getByRole("option", { name: new RegExp(title) }).first().click();
  await expect(page).toHaveURL(/\/tasks\/[a-f0-9]{24}/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("moves a task between board columns", async ({ page }) => {
  const title = `E2E board ${stamp()}`;

  await page.goto("/tasks/new");
  // The shortest path through the wizard: a title, then straight to review.
  await page.getByLabel("Title").fill(title);
  await continueThrough(page, "schedule", "payment", "attachments", "review");
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
  const addPerson = page.getByRole("dialog");
  await addPerson.getByLabel(/^Name/).fill(name);
  await continueThrough(addPerson, "opening", "review");
  await expect(addPerson.locator(".wizard-panel")).toContainText(name);
  await addPerson.getByRole("button", { name: "Add person" }).click();

  const row = page.getByRole("button", { name: new RegExp(name) });
  await expect(row).toBeVisible();

  await row.click();
  const detail = page.getByRole("dialog");
  await detail.getByLabel("Amount").fill("500");
  await continueTo(detail, "details");
  await detail.getByRole("button", { name: "Add transaction" }).click();

  // Running balance is computed at read time from the ordered ledger.
  await expect(page.getByRole("dialog")).toContainText("+৳500.00");

  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(row).toContainText("+৳500.00");
});

test("keeps a wallet balance consistent with its transactions", async ({ page }) => {
  const name = `E2E account ${stamp()}`;

  await page.goto("/wallet");
  await page.getByRole("button", { name: "Add account" }).click();
  const addAccount = page.getByRole("dialog");
  // Step one is the account type; "Cash" is preselected, so this is one press.
  await continueTo(addAccount, "details");
  await addAccount.getByLabel("Account name").fill(name);
  await continueTo(addAccount, "balance");
  await addAccount.getByLabel("Current balance").fill("1000");
  await continueTo(addAccount, "review");
  await addAccount.getByRole("button", { name: "Add account" }).click();

  const row = page.getByRole("button", { name: new RegExp(name) });
  await expect(row).toContainText("৳1,000.00");

  await row.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /Money out/ }).click();
  await dialog.getByLabel("Amount").fill("250.50");
  await continueTo(dialog, "details");
  // The step-two preview states the signed amount before it is committed.
  await expect(dialog.locator(".wizard-panel")).toContainText("−৳250.50");
  await dialog.getByRole("button", { name: "Add transaction" }).click();

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
