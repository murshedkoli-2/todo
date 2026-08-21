"use client";

import { useCallback, useState } from "react";
import {
  WizardState, WizardDirection,
  initialWizardState, advanceState, retreatState, jumpState, wizardProgress,
} from "@/lib/wizard";

export type { WizardDirection };

export interface WizardStepDef {
  /** Stable key, also used as the `data-step` attribute for tests. */
  id: string;
  /** Rail label. Kept to one or two words — the rail is not the place for prose. */
  label: string;
  /** Sentence shown above the panel, describing what this screen asks for. */
  description?: string;
  /**
   * Blocks "Next" while it returns a message. Returning `null` means the step
   * is satisfied. Steps with nothing required simply omit it.
   */
  validate?: () => string | null;
}

export interface Wizard {
  steps: ReadonlyArray<WizardStepDef>;
  index: number;
  current: WizardStepDef;
  direction: WizardDirection;
  isFirst: boolean;
  isLast: boolean;
  /** 0–1, used by the compact mobile progress bar. */
  progress: number;
  /** Validation message for the current step, or "" when it passes. */
  error: string;
  /** Advances if the current step validates; returns whether it moved. */
  next: () => boolean;
  /**
   * Advances without validating.
   *
   * For steps gated on a server round-trip — "email a verification code, then
   * ask for it" — where the caller owns the await and only knows the step
   * succeeded once the response lands. `next()` cannot express that without
   * becoming async for every caller that does not need it.
   */
  advance: () => void;
  back: () => void;
  /**
   * Jumps to a step. Only ever backwards or to one already visited; the review
   * screen's "edit" links rely on this.
   */
  goTo: (index: number) => void;
  setError: (message: string) => void;
  /** Validates the current step without moving. */
  validateCurrent: () => boolean;
}

/**
 * React binding for the step machine in `src/lib/wizard.ts`.
 *
 * The transitions themselves live there and are unit tested; what this adds is
 * the piece that genuinely needs to be a hook — running the current step's
 * `validate` before a move, and clearing the resulting message on the way out.
 * An error raised by the step you are leaving must not follow you onto the one
 * you are arriving at, which is why every transition resets it.
 *
 * `steps` is read fresh on each call rather than captured, so a `validate`
 * closing over current form state stays correct without the caller having to
 * memoise anything.
 */
export function useWizard(steps: ReadonlyArray<WizardStepDef>): Wizard {
  const [state, setState] = useState<WizardState>(initialWizardState);
  const [error, setError] = useState("");

  const { index, direction } = state;
  const current = steps[index];

  const validateCurrent = useCallback(() => {
    const message = steps[index]?.validate?.() ?? null;
    setError(message ?? "");
    return message === null;
  }, [steps, index]);

  const next = useCallback(() => {
    if (!validateCurrent()) return false;
    if (index >= steps.length - 1) return false;

    setState((previous) => advanceState(previous, steps.length));
    setError("");
    return true;
  }, [validateCurrent, index, steps.length]);

  const advance = useCallback(() => {
    setState((previous) => advanceState(previous, steps.length));
    setError("");
  }, [steps.length]);

  const back = useCallback(() => {
    setState(retreatState);
    setError("");
  }, []);

  const goTo = useCallback(
    (target: number) => {
      setState((previous) => jumpState(previous, target, steps.length));
      setError("");
    },
    [steps.length]
  );

  return {
    steps,
    index,
    current,
    direction,
    isFirst: index === 0,
    isLast: index === steps.length - 1,
    progress: wizardProgress(index, steps.length),
    error,
    next,
    advance,
    back,
    goTo,
    setError,
    validateCurrent,
  };
}
