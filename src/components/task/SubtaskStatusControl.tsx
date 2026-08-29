"use client";

import {
  SubtaskStatus, STATUS_COLORS, STATUS_LABELS,
  SUBTASK_STATUS_CHOICES, SUBTASK_STATUS_SHORT_LABELS,
} from "@/lib/types";
import { CheckIcon, CircleIcon, ClockIcon, SpinnerIcon } from "@/components/ui/icons";

/** The icon that stands for each state, in the one place that decides it. */
const STATUS_ICONS: Record<SubtaskStatus, (props: { className?: string }) => JSX.Element> = {
  todo: CircleIcon,
  in_progress: ClockIcon,
  completed: CheckIcon,
};

interface SubtaskStatusControlProps {
  value: SubtaskStatus;
  /** Called with the picked status. Never called for the one already set. */
  onChange: (status: SubtaskStatus) => void;
  /** What this control is for — the service name, used in the group's label. */
  name: string;
  /** Extra context for the label, e.g. the task title on a list of many. */
  context?: string;
  /** Replaces the active segment's icon with a spinner while the write runs. */
  busy?: boolean;
  disabled?: boolean;
  /** `sm` drops to icon-and-short-label for dense rows. */
  size?: "sm" | "md";
}

/**
 * The three states one leg of an errand can be in, as one control.
 *
 * A checkbox could only ever say "finished" or "not finished", and the state
 * this desk spends most of its day in is neither: a passport application that
 * has been lodged is not waiting on the operator, and filing it next to the
 * jobs nobody has started is what made the checklist stop being a to-do list.
 *
 * Rendered as three visible segments rather than a menu or a cycling tap
 * because the whole value is being able to read the state without operating
 * anything — and because "in progress" is a destination, not a stop on the way
 * to done. The dense card chips do cycle, for want of room; see
 * `nextSubtaskStatus`.
 */
export default function SubtaskStatusControl({
  value, onChange, name, context, busy = false, disabled = false, size = "md",
}: SubtaskStatusControlProps) {
  const small = size === "sm";

  return (
    <div
      role="radiogroup"
      aria-label={context ? `Status of ${name} on ${context}` : `Status of ${name}`}
      className="inline-flex gap-0.5 p-0.5 rounded-well flex-shrink-0"
      style={{ background: "var(--bg-sunken)" }}
      data-subtask-status={value}
    >
      {SUBTASK_STATUS_CHOICES.map((status) => {
        const active = status === value;
        const color = STATUS_COLORS[status];
        const StatusIcon = STATUS_ICONS[status];

        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || busy}
            /* A no-op re-click would still cost a request and a re-render, and
               on the optimistic surfaces it would flash the row for nothing. */
            onClick={() => !active && onChange(status)}
            className={`flex items-center gap-1 rounded-control font-bold transition-colors duration-fast disabled:opacity-50 ${
              small ? "h-6 px-1.5 text-[10px]" : "h-7 px-2 text-[11px]"
            }`}
            style={{
              background: active ? "var(--bg-card)" : "transparent",
              color: active ? color : "var(--text-muted)",
              boxShadow: active ? "var(--shadow-xs)" : "none",
            }}
          >
            {busy && active ? (
              <SpinnerIcon className={small ? "w-3 h-3" : "w-3.5 h-3.5"} />
            ) : (
              <StatusIcon className={small ? "w-3 h-3" : "w-3.5 h-3.5"} />
            )}
            {/* The short word carries the meaning on a phone; the full label is
                what a screen reader announces, since three icons named "To do",
                "Doing", "Done" are ambiguous read out of context. */}
            <span aria-hidden="true">{SUBTASK_STATUS_SHORT_LABELS[status]}</span>
            <span className="sr-only">{STATUS_LABELS[status]}</span>
          </button>
        );
      })}
    </div>
  );
}
