"use client";

import { useState } from "react";
import {
  Todo, SubtaskStatus, TaskService, getDisplayStatus, STATUS_COLORS, STATUS_LABELS,
  STATUS_TEXT_COLORS, SERVICE_LABELS, SERVICE_SHORT_LABELS, SERVICE_COLORS,
  SERVICE_TEXT_COLORS, describeSubtaskFields, isSubtaskDone, subtaskProgress,
} from "@/lib/types";
import { formatDueLabel } from "@/lib/dueDate";
import type { TodoStatus } from "@/lib/schemas/todo";
import Money from "@/components/ui/Money";
import PriorityFlag from "@/components/ui/PriorityFlag";
import SubtaskStatusControl from "@/components/task/SubtaskStatusControl";
import {
  CalendarIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, SpinnerIcon,
} from "@/components/ui/icons";

interface TaskListProps {
  todos: Todo[];
  onView: (todo: Todo) => void;
  onStatusChange: (id: string, status: TodoStatus) => void;
  /** Moves one leg of a task along from the list. */
  onSubtaskStatusChange: (
    id: string, service: TaskService, status: SubtaskStatus
  ) => Promise<void>;
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
  todos, onView, onStatusChange, onSubtaskStatusChange, pendingIds,
}: TaskListProps) {
  /* Expansion is per-row and additive — working through a morning's passport
     collections means keeping several open, not one at a time. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="statement">
      <ul className="animate-stagger">
        {todos.map((todo) => {
          const displayStatus = getDisplayStatus(todo);
          const isDone = todo.status === "completed";
          const isOverdue = displayStatus === "overdue";
          const pending = pendingIds.has(todo._id);

          const progress = subtaskProgress(todo.subtasks);
          const isExpanded = expanded.has(todo._id);

          return (
            <li key={todo._id} className="statement-row !flex-col !items-stretch gap-0 px-4 sm:px-5 py-3">
             <div className="flex items-center gap-3">
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
                {/*
                  One subtitle line, so services take the front of it: on this
                  desk they identify the row better than the first few words of
                  a description, which is what the line held on its own before.
                */}
                {(todo.subtasks.length > 0 || todo.description) && (
                  <span className="block text-xs truncate mt-0.5 text-ink-muted">
                    {todo.subtasks.map((subtask, index) => {
                      const { service, status } = subtask;
                      const done = isSubtaskDone(subtask);
                      return (
                        <span key={service}>
                          {index > 0 && <span className="text-ink-muted"> · </span>}
                          <span
                            className="font-semibold"
                            style={{
                              color: SERVICE_TEXT_COLORS[service],
                              textDecoration: done ? "line-through" : undefined,
                              /* A leg under way is neither struck through nor
                                 plain — italic is the only weightless way to
                                 mark it on a line this dense. */
                              fontStyle: status === "in_progress" ? "italic" : undefined,
                            }}
                          >
                            {SERVICE_SHORT_LABELS[service]}
                          </span>
                        </span>
                      );
                    })}
                    {todo.subtasks.length > 0 && (
                      <span className="font-semibold"> · {progress.done}/{progress.total}</span>
                    )}
                    {todo.subtasks.length > 0 && todo.description && " — "}
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

              {/*
                The checklist, opened in place. Walking to the task page and
                back to tick one leg off is the wrong shape for the surface
                where a whole morning's collections get closed out — and since
                the checklist now drives the status, this is where most tasks
                will actually finish.
              */}
              {progress.total > 0 && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(todo._id)}
                  className="btn-ghost w-8 h-8 px-0 flex-shrink-0"
                  aria-expanded={isExpanded}
                  aria-controls={`subtasks-${todo._id}`}
                  aria-label={`${isExpanded ? "Hide" : "Show"} the ${progress.total} sub-tasks of ${todo.title}`}
                >
                  {isExpanded
                    ? <ChevronDownIcon className="w-4 h-4" />
                    : <ChevronRightIcon className="w-4 h-4" />}
                </button>
              )}
             </div>

              {progress.total > 0 && isExpanded && (
                <SubtaskRows
                  id={`subtasks-${todo._id}`}
                  todo={todo}
                  onStatusChange={onSubtaskStatusChange}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface SubtaskRowsProps {
  id: string;
  todo: Todo;
  onStatusChange: (
    id: string, service: TaskService, status: SubtaskStatus
  ) => Promise<void>;
}

/**
 * A task's checklist, opened underneath its row.
 *
 * Read-only apart from the status. Editing a captured value belongs on the task
 * page, where there is room for the field labels and the help text that say
 * what a number is — a passport number typed into an unlabelled box in a list
 * row is a number typed into the wrong box. What this surface is for is moving
 * work along, which is what an operator does to a row here all day.
 *
 * Credential values never reach here: the list endpoint strips them, so
 * `describeSubtaskFields` has nothing to mask and nothing to leak.
 */
function SubtaskRows({ id, todo, onStatusChange }: SubtaskRowsProps) {
  const [saving, setSaving] = useState<TaskService | null>(null);

  const setStatus = async (service: TaskService, status: SubtaskStatus) => {
    setSaving(service);
    try {
      await onStatusChange(todo._id, service, status);
    } finally {
      setSaving(null);
    }
  };

  return (
    <ul id={id} className="flex flex-col gap-1.5 mt-2.5 ml-8 sm:ml-9 animate-fade-in">
      {todo.subtasks.map((subtask) => {
        const { service, status } = subtask;
        const done = isSubtaskDone(subtask);
        const color = SERVICE_COLORS[service];
        const described = describeSubtaskFields(subtask);

        return (
          <li
            key={service}
            className="well px-3 py-2 flex items-center gap-2.5"
            data-subtask={service}
            data-status={status}
            data-done={done}
            style={{ borderLeft: `3px solid ${color}` }}
          >
            <span className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2">
              <span
                className="text-xs font-bold"
                style={{
                  color: SERVICE_TEXT_COLORS[service],
                  textDecoration: done ? "line-through" : undefined,
                }}
              >
                {SERVICE_LABELS[service]}
              </span>
              {/* One line of what was captured, so the row is identifiable
                  without opening the task — usually the document number. */}
              {described.length > 0 && (
                <span className="text-[11px] truncate text-ink-muted">
                  {described.map((field) => `${field.label}: ${field.value}`).join(" · ")}
                </span>
              )}
            </span>

            {/* The task title goes into the control's group label: a page of
                sixty rows otherwise announces the same three options over and
                over with nothing to say which errand they belong to. */}
            <SubtaskStatusControl
              value={status}
              onChange={(next) => void setStatus(service, next)}
              name={SERVICE_LABELS[service]}
              context={todo.title}
              busy={saving === service}
              size="sm"
            />
          </li>
        );
      })}
    </ul>
  );
}
