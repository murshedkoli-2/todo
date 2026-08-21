import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Helpers for driving the multi-step forms.
 *
 * Every form in the app is a wizard, so the specs would otherwise repeat the
 * same "press Continue, wait for the panel to swap" dance a dozen times. The
 * waiting is the part worth centralising: the panel animates in, and asserting
 * on a field before the swap lands is how these specs would turn flaky.
 */

/** Scope for a wizard — the page, or a dialog when the form is in a modal. */
type Scope = Page | Locator;

/** Presses the wizard's forward button once and waits for the named step. */
export async function continueTo(scope: Scope, stepId: string): Promise<void> {
  await scope.getByRole("button", { name: "Continue" }).click();
  await expectStep(scope, stepId);
}

/** Waits until the panel for `stepId` is the one on screen. */
export async function expectStep(scope: Scope, stepId: string): Promise<void> {
  await expect(scope.locator(`.wizard-panel[data-step="${stepId}"]`)).toBeVisible();
}

/**
 * Walks forward through several steps by id, pressing Continue for each.
 *
 * Pass the steps you are travelling *to*, in order — the first entry is the
 * step reached by the first press, not the one you start on.
 */
export async function continueThrough(scope: Scope, ...stepIds: string[]): Promise<void> {
  for (const stepId of stepIds) await continueTo(scope, stepId);
}

/** Presses the named final-step button, e.g. "Create task". */
export async function submitWizard(scope: Scope, label: string): Promise<void> {
  await scope.getByRole("button", { name: label, exact: true }).click();
}
