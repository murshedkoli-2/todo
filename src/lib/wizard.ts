/**
 * The step machine behind every form in the app.
 *
 * Kept as pure functions over a plain state object, separately from the React
 * hook that owns it, because this is where a wizard actually goes wrong: it
 * lets you skip a step you have not satisfied, it forgets how far you had got
 * when you go back, or it animates a "Back" as though it were a "Next". None of
 * those need a DOM to reproduce, and the repo's test split puts logic like this
 * in vitest rather than behind a browser.
 *
 * `useWizard` in `src/components/ui/wizard/` is a thin wrapper over these.
 */

/** Which way the panel should animate — mirrors how the user moved. */
export type WizardDirection = "next" | "prev";

export interface WizardState {
  /** Index of the step on screen. */
  index: number;
  /** Furthest index reached, so backwards navigation knows what is unlocked. */
  furthest: number;
  direction: WizardDirection;
}

export function initialWizardState(): WizardState {
  return { index: 0, furthest: 0, direction: "next" };
}

/**
 * Advances one step, clamped to the last.
 *
 * Callers gate this on validation themselves — the machine deliberately does
 * not know how to validate, so the same transition serves both the synchronous
 * "Next" and the steps that are unlocked by a server round-trip.
 */
export function advanceState(state: WizardState, stepCount: number): WizardState {
  const index = Math.min(stepCount - 1, state.index + 1);
  return {
    index,
    furthest: Math.max(state.furthest, index),
    direction: "next",
  };
}

/** Steps back one, clamped at the first. `furthest` is deliberately kept. */
export function retreatState(state: WizardState): WizardState {
  return {
    ...state,
    index: Math.max(0, state.index - 1),
    direction: "prev",
  };
}

/**
 * True when `target` is a step the user is allowed to jump to.
 *
 * Backwards is always fine; forwards only as far as they have already been.
 * This is what stops the rail and the review screen's edit links from being a
 * way around a validation the "Next" button enforces.
 */
export function canJumpTo(state: WizardState, target: number, stepCount: number): boolean {
  if (!Number.isInteger(target)) return false;
  if (target < 0 || target >= stepCount) return false;
  if (target === state.index) return false;
  return target <= state.furthest;
}

/** Jumps to `target`, or returns the state unchanged when the jump is illegal. */
export function jumpState(state: WizardState, target: number, stepCount: number): WizardState {
  if (!canJumpTo(state, target, stepCount)) return state;
  return {
    ...state,
    index: target,
    direction: target > state.index ? "next" : "prev",
  };
}

/**
 * Position through the flow, 0–1, for the compact mobile progress bar.
 *
 * Measured across the *gaps* between steps rather than the steps themselves, so
 * the first step reads as 0 and the last as 1. Dividing by `stepCount` instead
 * would leave the final step short of full, which reads as an error.
 */
export function wizardProgress(index: number, stepCount: number): number {
  if (stepCount <= 1) return 1;
  const clamped = Math.min(Math.max(index, 0), stepCount - 1);
  return clamped / (stepCount - 1);
}
