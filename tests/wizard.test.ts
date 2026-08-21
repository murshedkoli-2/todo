import { describe, expect, test } from "vitest";
import {
  initialWizardState,
  advanceState,
  retreatState,
  canJumpTo,
  jumpState,
  wizardProgress,
} from "@/lib/wizard";

/**
 * Every form in the app is driven by this machine, so the failures worth
 * pinning down are the ones that would let a user reach the last screen of a
 * wizard without having satisfied the first — or lose their place going back.
 */

const STEPS = 4;

/** Walks forward `count` times from a fresh state. */
function afterAdvances(count: number, stepCount = STEPS) {
  let state = initialWizardState();
  for (let i = 0; i < count; i += 1) state = advanceState(state, stepCount);
  return state;
}

describe("initialWizardState", () => {
  test("starts on the first step with nothing unlocked ahead", () => {
    expect(initialWizardState()).toEqual({ index: 0, furthest: 0, direction: "next" });
  });

  test("returns a fresh object each call so two wizards cannot share state", () => {
    const first = initialWizardState();
    const second = initialWizardState();
    expect(first).not.toBe(second);
  });
});

describe("advanceState", () => {
  test("moves forward one step", () => {
    expect(advanceState(initialWizardState(), STEPS).index).toBe(1);
  });

  test("records the direction so the panel animates forward", () => {
    expect(advanceState(initialWizardState(), STEPS).direction).toBe("next");
  });

  test("raises the furthest step reached", () => {
    expect(afterAdvances(2).furthest).toBe(2);
  });

  test("clamps at the last step rather than running past the end", () => {
    const state = afterAdvances(10);
    expect(state.index).toBe(STEPS - 1);
    expect(state.furthest).toBe(STEPS - 1);
  });

  test("does not mutate the state it was given", () => {
    const state = initialWizardState();
    advanceState(state, STEPS);
    expect(state.index).toBe(0);
  });

  test("a single-step wizard stays put", () => {
    expect(advanceState(initialWizardState(), 1).index).toBe(0);
  });
});

describe("retreatState", () => {
  test("moves back one step", () => {
    expect(retreatState(afterAdvances(2)).index).toBe(1);
  });

  test("records the direction so the panel animates backwards", () => {
    expect(retreatState(afterAdvances(1)).direction).toBe("prev");
  });

  test("keeps the furthest step reached, so forward jumps stay unlocked", () => {
    const state = retreatState(afterAdvances(3));
    expect(state.index).toBe(2);
    expect(state.furthest).toBe(3);
  });

  test("clamps at the first step", () => {
    expect(retreatState(initialWizardState()).index).toBe(0);
  });
});

describe("canJumpTo", () => {
  const visited = afterAdvances(2); // index 2, furthest 2

  test("allows jumping back to a step already seen", () => {
    expect(canJumpTo(visited, 0, STEPS)).toBe(true);
  });

  test("allows jumping forward only as far as the furthest step reached", () => {
    const backAtStart = retreatState(retreatState(visited)); // index 0, furthest 2
    expect(canJumpTo(backAtStart, 2, STEPS)).toBe(true);
  });

  test("refuses a step past the furthest reached", () => {
    expect(canJumpTo(visited, 3, STEPS)).toBe(false);
  });

  test("refuses the step already on screen", () => {
    expect(canJumpTo(visited, 2, STEPS)).toBe(false);
  });

  test.each([-1, STEPS, 99])("refuses the out-of-range index %i", (target) => {
    expect(canJumpTo(visited, target, STEPS)).toBe(false);
  });

  test("refuses a non-integer index", () => {
    expect(canJumpTo(visited, 1.5, STEPS)).toBe(false);
  });
});

describe("jumpState", () => {
  test("moves to a visited step", () => {
    expect(jumpState(afterAdvances(2), 0, STEPS).index).toBe(0);
  });

  test("animates backwards when the target is behind", () => {
    expect(jumpState(afterAdvances(2), 1, STEPS).direction).toBe("prev");
  });

  test("animates forwards when the target is ahead", () => {
    const backAtStart = retreatState(retreatState(afterAdvances(2)));
    expect(jumpState(backAtStart, 2, STEPS).direction).toBe("next");
  });

  test("returns the same state untouched when the jump is illegal", () => {
    const state = afterAdvances(1);
    expect(jumpState(state, 3, STEPS)).toBe(state);
  });

  test("keeps the furthest step reached", () => {
    expect(jumpState(afterAdvances(3), 0, STEPS).furthest).toBe(3);
  });
});

describe("wizardProgress", () => {
  test("the first step reads as empty", () => {
    expect(wizardProgress(0, STEPS)).toBe(0);
  });

  test("the last step reads as full", () => {
    expect(wizardProgress(STEPS - 1, STEPS)).toBe(1);
  });

  test("intermediate steps divide the gaps evenly", () => {
    expect(wizardProgress(1, STEPS)).toBeCloseTo(1 / 3);
    expect(wizardProgress(2, STEPS)).toBeCloseTo(2 / 3);
  });

  test("a single-step wizard is complete", () => {
    expect(wizardProgress(0, 1)).toBe(1);
  });

  test.each([
    [-5, 0],
    [99, 1],
  ])("clamps an out-of-range index %i to %f", (index, expected) => {
    expect(wizardProgress(index, STEPS)).toBe(expected);
  });
});
