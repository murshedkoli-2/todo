"use client";

import { ChevronLeftIcon, ChevronRightIcon, SpinnerIcon } from "@/components/ui/icons";
import type { Wizard } from "./useWizard";

interface WizardFooterProps {
  wizard: Wizard;
  /** Label for the final step's button, e.g. "Create task". */
  submitLabel: string;
  submitIcon?: React.ReactNode;
  busy?: boolean;
  /** Disables forward movement — used while uploads are still in flight. */
  disabled?: boolean;
  /** Replaces "Back" on the first step, e.g. a Cancel link in a modal. */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Extra control on the far left, e.g. "Delete task" when editing. */
  leading?: React.ReactNode;
}

/**
 * Back / Next / Submit for a wizard.
 *
 * Deliberately renders one forward button whose label and behaviour change on
 * the last step, rather than a "Next" that hides itself next to a "Submit" that
 * appears. Keeping the element in place means the primary action never moves
 * under the pointer between steps, and on mobile it stays under the same thumb
 * for the whole flow.
 *
 * That button is a `submit` only on the last step; everywhere else it is a
 * plain button that advances. Combined with the caller's `onSubmit` guard, that
 * is what stops Enter in a text field from posting a half-filled form.
 */
export default function WizardFooter({
  wizard, submitLabel, submitIcon, busy = false,
  disabled = false, onCancel, cancelLabel = "Cancel", leading,
}: WizardFooterProps) {
  const { isFirst, isLast, back, next } = wizard;

  return (
    <div className="wizard-footer flex-col-reverse sm:flex-row">
      {leading ? <div className="w-full sm:w-auto sm:mr-auto">{leading}</div> : null}

      <div className="flex items-center gap-3 w-full sm:w-auto sm:ml-auto">
        {isFirst ? (
          onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="btn-outline flex-1 sm:flex-none"
            >
              {cancelLabel}
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={back}
            disabled={busy}
            className="btn-outline flex-1 sm:flex-none"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back
          </button>
        )}

        <button
          type={isLast ? "submit" : "button"}
          onClick={isLast ? undefined : () => next()}
          disabled={busy || disabled}
          className="btn-primary flex-1 sm:flex-none px-6"
        >
          {busy && <SpinnerIcon className="w-4 h-4" />}
          <span>{isLast ? (busy ? "Saving…" : submitLabel) : "Continue"}</span>
          {isLast
            ? !busy && submitIcon
            : <ChevronRightIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
