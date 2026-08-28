"use client";

import { useState } from "react";
import {
  TaskService, ServiceFieldDef, MAX_FIELD_LENGTH,
} from "@/lib/types";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

interface SubtaskFieldInputProps {
  service: TaskService;
  definition: ServiceFieldDef;
  value: string;
  onChange: (service: TaskService, key: string, value: string) => void;
  disabled?: boolean;
  /** Distinguishes two inputs for the same field on one page. */
  idPrefix?: string;
}

/**
 * One captured value on a sub-task.
 *
 * Shared by the creation wizard and the task page's own editor, because they
 * are the same control: a credential has to mask, reveal on a deliberate press,
 * and stay out of the operator's password manager in both places, and a copy
 * of that in each file is a copy that drifts. The task page is the one that
 * would drift the wrong way — it is the screen that faces a counter.
 */
export default function SubtaskFieldInput({
  service, definition, value, onChange, disabled = false, idPrefix = "subtask",
}: SubtaskFieldInputProps) {
  const [revealed, setRevealed] = useState(false);
  const isSecret = definition.type === "secret";
  const id = `${idPrefix}-${service}-${definition.key}`;
  const helpId = definition.help ? `${id}-help` : undefined;

  const inputType = definition.type === "date"
    ? "date"
    : isSecret && !revealed
      ? "password"
      : "text";

  return (
    <div className={isSecret ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="field-label">
        {definition.label}
      </label>

      <div className={isSecret ? "relative" : undefined}>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(event) => onChange(service, definition.key, event.target.value)}
          placeholder={definition.placeholder}
          maxLength={MAX_FIELD_LENGTH}
          disabled={disabled}
          aria-describedby={helpId}
          /*
           * A customer's credential must not be offered to the operator's own
           * password manager, nor filled from it — this box belongs to whoever
           * is standing at the counter, not to whoever is signed in.
           * `new-password` is what actually suppresses both in Chrome and
           * Safari; `off` alone is widely ignored.
           */
          autoComplete={isSecret ? "new-password" : "off"}
          spellCheck={isSecret ? false : undefined}
          data-1p-ignore={isSecret ? "" : undefined}
          className={`input-dark ${isSecret ? "!pr-11" : ""}`}
        />

        {isSecret && (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-pressed={revealed}
            aria-label={revealed ? `Hide ${definition.label}` : `Show ${definition.label}`}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-ink-muted hover:text-ink transition-colors duration-fast"
          >
            {revealed ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        )}
      </div>

      {definition.help && (
        <span id={helpId} className="field-hint">
          {definition.help}
        </span>
      )}
    </div>
  );
}
