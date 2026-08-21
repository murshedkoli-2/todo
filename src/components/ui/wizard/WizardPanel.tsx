"use client";

import type { Wizard } from "./useWizard";

interface WizardPanelProps {
  wizard: Wizard;
  children: React.ReactNode;
  /** Extra classes for the inner layout, e.g. a grid on the wider steps. */
  className?: string;
}

/**
 * Animated container for the current step's fields.
 *
 * The `key` is what makes the transition work: re-keying on the step index
 * forces React to mount a fresh element, so the CSS entrance animation runs
 * again on every move. Without it the panel's contents would swap silently and
 * a wizard would feel like a form that keeps replacing itself.
 *
 * `data-direction` picks which entrance plays — see `stepInNext`/`stepInPrev`
 * in `globals.css`.
 *
 * Deliberately carries no `role`/`aria-label`. Naming the container after the
 * step made the panel a second match for its own field — a "Password" step
 * wrapping a "Password" input gave two elements with that accessible name, so
 * anything resolving a control by name got an ambiguous result. Announcing the
 * move is `Stepper`'s live region instead, which is the thing that actually
 * changes.
 */
export default function WizardPanel({ wizard, children, className = "" }: WizardPanelProps) {
  const { index, current, direction } = wizard;

  return (
    <div
      key={index}
      className={`wizard-panel ${className}`}
      data-direction={direction}
      data-step={current.id}
    >
      {current.description && (
        <p className="text-sm mb-5 text-ink-secondary">{current.description}</p>
      )}
      {children}
    </div>
  );
}
