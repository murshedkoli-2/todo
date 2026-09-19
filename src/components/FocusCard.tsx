"use client";

import {
  Todo, STATUS_COLORS, STATUS_LABELS, STATUS_TEXT_COLORS, getDisplayStatus,
} from "@/lib/types";
import { daysUntilDue } from "@/lib/dueDate";
import Money from "@/components/ui/Money";
import PriorityFlag from "@/components/ui/PriorityFlag";
import { ArrowUpIcon, ClockIcon } from "@/components/ui/icons";

interface FocusCardProps {
  todo: Todo;
  onOpen: (todo: Todo) => void;
}

function urgency(dueDate: string): { headline: string; tone: string } {
  const days = daysUntilDue(dueDate);
  if (days === null) return { headline: "Due date unreadable", tone: "var(--text-muted)" };
  if (days < 0) {
    return {
      headline: days === -1 ? "1 day overdue" : `${Math.abs(days)} days overdue`,
      tone: "var(--red)",
    };
  }
  if (days === 0) return { headline: "Due today", tone: "var(--yellow)" };
  if (days === 1) return { headline: "Due tomorrow", tone: "var(--yellow)" };
  return { headline: `Due in ${days} days`, tone: "var(--accent)" };
}

/**
 * The next thing to do, given the wide cell of the bento row.
 *
 * A grid of equally weighted cards makes every task look equally urgent. This
 * pulls one out — the soonest deadline still open — and states the deadline in
 * words, which is the form the answer is actually needed in.
 */
export default function FocusCard({ todo, onOpen }: FocusCardProps) {
  const { headline, tone } = urgency(todo.dueDate!);
  const displayStatus = getDisplayStatus(todo);
  const isOverdue = displayStatus === "overdue";

  return (
    <article
      className="panel-hero h-full p-5 sm:p-6 flex flex-col relative group"
      aria-labelledby={`focus-${todo._id}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}
        >
          <ClockIcon className="w-4 h-4" />
        </span>
        <span className="text-eyebrow" style={{ color: tone }}>
          Up next
        </span>
        <span className="flex-1" />
        <PriorityFlag priority={todo.priority} className="flex-shrink-0" />
        <span
          className="pill"
          style={{
            background: `color-mix(in srgb, ${STATUS_COLORS[todo.status]} 14%, transparent)`,
            color: STATUS_TEXT_COLORS[todo.status],
          }}
        >
          {STATUS_LABELS[todo.status]}
        </span>
        {isOverdue && <span className="pill bg-red-soft text-red-ink">Overdue</span>}
      </div>

      <p className="text-section mb-1" style={{ color: tone }}>
        {headline}
      </p>

      <h2 id={`focus-${todo._id}`} className="text-lg font-bold leading-snug tracking-tight">
        <button
          type="button"
          onClick={() => onOpen(todo)}
          className="text-left line-clamp-2 after:absolute after:inset-0 after:content-['']"
        >
          {todo.title}
        </button>
      </h2>

      {todo.description && (
        <p className="text-[13px] leading-relaxed line-clamp-2 mt-1.5 text-ink-secondary">
          {todo.description}
        </p>
      )}

      <div className="flex-1 min-h-[16px]" />

      <div className="flex items-center gap-3 pt-4 mt-4 border-t border-line">
        {todo.paymentAmountMinor != null ? (
          <Money
            minor={todo.paymentAmountMinor}
            currency={todo.paymentCurrency}
            size="lg"
            tone="neutral"
            compact
          />
        ) : (
          <span className="text-sm font-medium text-ink-secondary">Open this task</span>
        )}
        <span className="flex-1" />
        <ArrowUpIcon
          className="w-4 h-4 rotate-45 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 text-ink-muted"
        />
      </div>
    </article>
  );
}
