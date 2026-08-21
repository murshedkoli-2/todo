"use client";

import {
  Todo, getDisplayStatus, STATUS_COLORS, STATUS_LABELS, STATUS_TEXT_COLORS,
} from "@/lib/types";
import { formatDueLabel } from "@/lib/dueDate";
import type { TodoStatus } from "@/lib/schemas/todo";
import Money from "@/components/ui/Money";
import PriorityFlag from "@/components/ui/PriorityFlag";
import { CalendarIcon, CheckIcon, SpinnerIcon } from "@/components/ui/icons";

interface TaskListProps {
  todos: Todo[];
  onView: (todo: Todo) => void;
  onStatusChange: (id: string, status: TodoStatus) => void;
  /** Ids with a status change in flight. */
  pendingIds: ReadonlySet<string>;
}

/**
 * Dense, ruled task list.
 *
 * The grid gives every task a cover image and a card of its own, which is the
 * right shape for browsing twelve tasks and the wrong one for working through
 * sixty: at that length the eye needs a single column of titles and a single
 * column of dates, not a mosaic. This is the same `statement` treatment the
 * ledger and wallet already use for their histories.
 *
 * Completion is a checkbox here rather than a menu — on a list, the action
 * taken on almost every row is "this is done", and it should cost one click.
 */
export default function TaskList({
  todos, onView, onStatusChange, pendingIds,
}: TaskListProps) {
  return (
    <div className="statement">
      <ul className="animate-stagger">
        {todos.map((todo) => {
          const displayStatus = getDisplayStatus(todo);
          const isDone = todo.status === "completed";
          const isOverdue = displayStatus === "overdue";
          const pending = pendingIds.has(todo._id);

          return (
            <li key={todo._id} className="statement-row gap-3 px-4 sm:px-5 py-3">
              {/* Toggle, not a menu: a list is where work gets closed out. */}
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                disabled={pending}
                onClick={() => onStatusChange(todo._id, isDone ? "todo" : "completed")}
                className="task-check flex-shrink-0"
                data-checked={isDone}
                aria-label={isDone ? `Reopen ${todo.title}` : `Mark ${todo.title} complete`}
              >
                {pending ? (
                  <SpinnerIcon className="w-3.5 h-3.5" />
                ) : (
                  isDone && <CheckIcon className="w-3.5 h-3.5" />
                )}
              </button>

              <PriorityFlag priority={todo.priority} className="flex-shrink-0" />

              <button
                type="button"
                onClick={() => onView(todo)}
                className="flex-1 min-w-0 text-left"
              >
                <span
                  className="block text-sm font-semibold truncate text-ink"
                  style={isDone ? { textDecoration: "line-through", opacity: 0.55 } : undefined}
                >
                  {todo.title}
                </span>
                {todo.description && (
                  <span className="block text-xs truncate mt-0.5 text-ink-muted">
                    {todo.description}
                  </span>
                )}
              </button>

              {todo.paymentAmountMinor != null && (
                <Money
                  minor={todo.paymentAmountMinor}
                  currency={todo.paymentCurrency}
                  size="sm"
                  tone="neutral"
                  compact
                  className="hidden sm:block flex-shrink-0"
                />
              )}

              {todo.dueDate && (
                <span
                  className="hidden xs:inline-flex items-center gap-1 text-xs font-medium flex-shrink-0 tabular-nums"
                  style={{ color: isOverdue ? "var(--red-ink)" : "var(--text-muted)" }}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {formatDueLabel(todo.dueDate, { relative: !isDone })}
                </span>
              )}

              <span
                className="hidden md:inline-flex items-center gap-1.5 flex-shrink-0 w-24"
                style={{ color: STATUS_TEXT_COLORS[displayStatus] }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: STATUS_COLORS[displayStatus] }}
                />
                <span className="text-[11px] font-semibold uppercase tracking-wide truncate">
                  {STATUS_LABELS[displayStatus]}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
