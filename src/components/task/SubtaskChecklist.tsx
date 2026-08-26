"use client";

import { useState } from "react";
import {
  TaskService, TaskSubtask,
  SERVICE_FIELDS, SERVICE_LABELS, SERVICE_COLORS, SERVICE_TEXT_COLORS,
  SERVICE_ON_COLORS,
  describeSubtaskFields, missingFieldCount, subtaskProgress,
} from "@/lib/types";
import ProgressBar from "@/components/ui/ProgressBar";
import { CheckIcon, EyeIcon, EyeOffIcon, SpinnerIcon } from "@/components/ui/icons";

interface SubtaskChecklistProps {
  subtasks: TaskSubtask[];
  /** Persists the tick. Rejecting the promise rolls the row back. */
  onToggleDone: (service: TaskService) => Promise<void>;
  /** True while any tick is in flight, which disables the rest. */
  busy?: boolean;
}

/**
 * The ticked services as a working checklist on the task page.
 *
 * The task's own status says whether the *whole* errand is finished, which is
 * too coarse for a customer who brought three jobs: two collected, one still at
 * the passport office reads as "in progress" either way. Ticking the legs off
 * individually is the only thing on this page that says which one is waiting.
 *
 * Credentials render masked. Revealing one is per-field and resets on
 * navigation — there is no reason for a password to sit uncovered on a screen
 * at a counter that faces the public.
 */
export default function SubtaskChecklist({
  subtasks, onToggleDone, busy = false,
}: SubtaskChecklistProps) {
  const progress = subtaskProgress(subtasks);

  return (
    <section className="panel">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-eyebrow">Sub-tasks ({progress.total})</h2>
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {progress.done} of {progress.total} done
        </span>
      </div>

      {/* `ProgressBar` takes a percentage, and `total` is never 0 here — the
          whole section is omitted when there are no sub-tasks. */}
      <ProgressBar
        value={(progress.done / progress.total) * 100}
        label={`${progress.done} of ${progress.total} sub-tasks done`}
      />

      <ul className="flex flex-col gap-2 mt-4">
        {subtasks.map((subtask) => (
          <SubtaskRow
            key={subtask.service}
            subtask={subtask}
            onToggleDone={onToggleDone}
            busy={busy}
          />
        ))}
      </ul>
    </section>
  );
}

interface SubtaskRowProps {
  subtask: TaskSubtask;
  onToggleDone: (service: TaskService) => Promise<void>;
  busy: boolean;
}

function SubtaskRow({ subtask, onToggleDone, busy }: SubtaskRowProps) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { service, done } = subtask;
  const color = SERVICE_COLORS[service];
  /* Described masked, then the one revealed field is swapped back from the
     source. Passing `revealSecrets` here would uncover every credential on the
     row at once, which is only invisible today because no service defines two. */
  const described = describeSubtaskFields(subtask);
  const missing = missingFieldCount(subtask);

  const toggle = async () => {
    setSaving(true);
    try {
      await onToggleDone(service);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li
      className="well p-3.5 flex items-start gap-3"
      data-subtask={service}
      data-done={done}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {/* The whole tick is one button rather than a checkbox plus a label, so
          the hit area on a phone is the control and not a 16px square. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark ${SERVICE_LABELS[service]} as ${done ? "not done" : "done"}`}
        onClick={toggle}
        disabled={busy || saving}
        className="w-5 h-5 mt-0.5 rounded-md flex-shrink-0 flex items-center justify-center transition-colors duration-fast disabled:opacity-50"
        style={{
          background: done ? color : "transparent",
          border: `1.5px solid ${done ? color : "var(--border-hover)"}`,
          color: SERVICE_ON_COLORS[service],
        }}
      >
        {saving
          ? <SpinnerIcon className="w-3 h-3" />
          : done && <CheckIcon className="w-3 h-3" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span
            className="text-[13px] font-bold leading-tight"
            style={{
              color: SERVICE_TEXT_COLORS[service],
              /* Struck through rather than faded: a finished leg still has to
                 be readable, because the numbers on it are what gets quoted
                 back to the customer when they ring up about it. */
              textDecoration: done ? "line-through" : undefined,
            }}
          >
            {SERVICE_LABELS[service]}
          </span>
          {missing > 0 && (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {missing} of {SERVICE_FIELDS[service].length} not recorded
            </span>
          )}
        </div>

        {described.length > 0 && (
          <dl className="mt-1.5 flex flex-col gap-1">
            {described.map((field) => (
              <div key={field.key} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <dt style={{ color: "var(--text-muted)" }}>{field.label}</dt>
                <dd
                  className={field.secret ? "font-mono" : "font-medium"}
                  style={{ color: "var(--text-secondary)" }}
                >
                  {field.secret && revealed === field.key
                    ? subtask.fields[field.key]
                    : field.value}
                </dd>
                {field.secret && (
                  <button
                    type="button"
                    onClick={() =>
                      setRevealed((current) => (current === field.key ? null : field.key))
                    }
                    aria-pressed={revealed === field.key}
                    aria-label={
                      revealed === field.key
                        ? `Hide ${field.label}`
                        : `Show ${field.label}`
                    }
                    className="text-ink-muted hover:text-ink transition-colors duration-fast"
                  >
                    {revealed === field.key
                      ? <EyeOffIcon className="w-3.5 h-3.5" />
                      : <EyeIcon className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            ))}
          </dl>
        )}
      </div>
    </li>
  );
}
