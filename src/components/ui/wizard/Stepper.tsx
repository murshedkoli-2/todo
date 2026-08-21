"use client";

import { CheckIcon } from "@/components/ui/icons";
import type { Wizard } from "./useWizard";

interface StepperProps {
  wizard: Wizard;
  /** Hides the per-step labels, for the tighter rails inside modals. */
  compact?: boolean;
}

/**
 * The wizard's progress rail.
 *
 * Two presentations of the same state, chosen by width rather than by prop: on
 * `sm`+ the full rail of numbered dots and connectors, and on narrow screens a
 * single filled bar with a "Step 2 of 4" readout. A five-dot rail squeezed into
 * 320px produced 18px targets and clipped labels, which is a worse answer than
 * not showing the dots at all — the bar still communicates the two things that
 * matter on a phone, how far along you are and how much is left.
 *
 * Completed steps are buttons; the ones ahead are disabled. `useWizard` also
 * enforces that, so the disabled attribute here is about not offering a target
 * the user cannot use rather than about being the guard itself.
 */
export default function Stepper({ wizard, compact = false }: StepperProps) {
  const { steps, index, goTo, progress } = wizard;

  return (
    <div>
      {/*
        The one announcement of a step change. It lives here rather than on the
        panel because the panel's accessible name would collide with the field
        inside it — see the note in `WizardPanel`.
      */}
      <p className="sr-only" aria-live="polite">
        Step {index + 1} of {steps.length}: {steps[index].label}
      </p>

      {/* ── Compact bar (below sm) ───────────────────────────────────────── */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-eyebrow">
            Step {index + 1} of {steps.length}
          </span>
          <span className="text-xs font-semibold text-ink">{steps[index].label}</span>
        </div>
        <div
          className="wizard-progress"
          style={{ "--progress": progress } as React.CSSProperties}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-label={`Step ${index + 1} of ${steps.length}: ${steps[index].label}`}
        />
      </div>

      {/* ── Full rail (sm and up) ────────────────────────────────────────── */}
      <ol className="wizard-rail hidden sm:flex" aria-label="Form progress">
        {steps.map((step, position) => {
          const state =
            position < index ? "done" : position === index ? "current" : "todo";
          const reachable = position < index;

          return (
            <li
              key={step.id}
              className={`flex items-center ${position === steps.length - 1 ? "" : "flex-1"} min-w-0`}
            >
              <button
                type="button"
                className="wizard-step"
                data-state={state}
                data-step={step.id}
                disabled={!reachable}
                onClick={() => goTo(position)}
                aria-current={state === "current" ? "step" : undefined}
                aria-label={
                  reachable
                    ? `Go back to step ${position + 1}, ${step.label}`
                    : `Step ${position + 1}, ${step.label}`
                }
              >
                <span className="wizard-dot" data-state={state} aria-hidden="true">
                  {state === "done" ? <CheckIcon className="w-4 h-4" /> : position + 1}
                </span>
                {!compact && <span className="wizard-step-label">{step.label}</span>}
              </button>

              {position < steps.length - 1 && (
                <span
                  className="wizard-connector mx-2"
                  data-filled={position < index}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
