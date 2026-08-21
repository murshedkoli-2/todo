"use client";

import { useMemo, useState } from "react";
import {
  BOARD_COLUMNS, STATUS_COLORS, STATUS_LABELS, Todo, getDisplayStatus,
} from "@/lib/types";
import { formatDueLabel } from "@/lib/dueDate";
import type { TodoStatus } from "@/lib/schemas/todo";
import Money from "@/components/ui/Money";
import PriorityFlag from "@/components/ui/PriorityFlag";
import { AlertIcon, CalendarIcon, SpinnerIcon } from "@/components/ui/icons";

interface TaskBoardProps {
  todos: Todo[];
  onView: (todo: Todo) => void;
  onStatusChange: (id: string, status: TodoStatus) => void;
  /** Ids with a status change in flight. */
  pendingIds: ReadonlySet<string>;
}

const DRAG_MIME = "application/x-taskflow-todo";

/**
 * Status board.
 *
 * Status is the primary axis of this data and the app only ever offered a flat
 * grid, so moving work along required opening a menu per card. Drag and drop
 * is the fast path; every card also carries a native `<select>` so the board is
 * fully operable by keyboard and on touch, where HTML5 drag events do not fire.
 */
export default function TaskBoard({
  todos, onView, onStatusChange, pendingIds,
}: TaskBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TodoStatus | null>(null);

  const columns = useMemo(() => {
    const grouped = new Map<TodoStatus, Todo[]>(
      BOARD_COLUMNS.map((status) => [status, [] as Todo[]])
    );
    for (const todo of todos) grouped.get(todo.status)?.push(todo);
    return grouped;
  }, [todos]);

  const handleDrop = (status: TodoStatus) => {
    setDropTarget(null);
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;

    const todo = todos.find((item) => item._id === id);
    if (todo && todo.status !== status) onStatusChange(id, status);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start animate-stagger">
      {BOARD_COLUMNS.map((status) => {
        const items = columns.get(status) ?? [];
        const color = STATUS_COLORS[status];

        return (
          <section
            key={status}
            className="board-column"
            data-drop-target={dropTarget === status}
            aria-label={`${STATUS_LABELS[status]} — ${items.length} task${items.length === 1 ? "" : "s"}`}
            onDragOver={(event) => {
              // Required for the column to be a valid drop zone at all.
              if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
              event.preventDefault();
              setDropTarget(status);
            }}
            onDragLeave={(event) => {
              // Ignore bubbling from children, or the highlight flickers.
              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
              setDropTarget((current) => (current === status ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(status);
            }}
          >
            <header className="flex items-center gap-2.5 px-4 h-12 flex-shrink-0 border-b border-line">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink">
                {STATUS_LABELS[status]}
              </h2>
              <span className="text-xs font-semibold tabular-nums text-ink-muted">
                {items.length}
              </span>
            </header>

            <div className="flex flex-col gap-2.5 p-2.5 min-h-[7rem]">
              {items.length === 0 ? (
                <p className="text-xs text-center py-8 text-ink-muted">
                  Drop a task here
                </p>
              ) : (
                items.map((todo) => {
                  const overdue = getDisplayStatus(todo) === "overdue";
                  const pending = pendingIds.has(todo._id);

                  return (
                    <article
                      key={todo._id}
                      className="board-card p-3"
                      draggable={!pending}
                      data-dragging={draggingId === todo._id}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(DRAG_MIME, todo._id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingId(todo._id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTarget(null);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <PriorityFlag
                          priority={todo.priority}
                          className="flex-shrink-0 mt-0.5"
                        />
                        <button
                          type="button"
                          onClick={() => onView(todo)}
                          className="flex-1 min-w-0 text-left text-sm font-semibold leading-snug line-clamp-2 text-ink"
                        >
                          {todo.title}
                        </button>
                        {pending && (
                          <SpinnerIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-ink-muted" />
                        )}
                      </div>

                      {(todo.dueDate || todo.paymentAmountMinor != null) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                          {todo.dueDate && (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-medium"
                              style={{
                                color: overdue ? "var(--red-ink)" : "var(--text-muted)",
                              }}
                            >
                              {overdue ? (
                                <AlertIcon className="w-3 h-3" />
                              ) : (
                                <CalendarIcon className="w-3 h-3" />
                              )}
                              {formatDueLabel(todo.dueDate, { relative: todo.status !== "completed" })}
                            </span>
                          )}
                          {todo.paymentAmountMinor != null && (
                            <Money
                              minor={todo.paymentAmountMinor}
                              currency={todo.paymentCurrency}
                              size="sm"
                              tone="neutral"
                              compact
                            />
                          )}
                        </div>
                      )}

                      {/* Keyboard and touch path — drag events do neither. */}
                      <label className="mt-2.5 block">
                        <span className="sr-only">Move “{todo.title}” to another column</span>
                        <select
                          value={todo.status}
                          disabled={pending}
                          onChange={(event) =>
                            onStatusChange(todo._id, event.target.value as TodoStatus)
                          }
                          className="w-full h-7 px-2 text-[11px] font-medium rounded-control cursor-pointer bg-sunken border border-transparent text-ink-secondary hover:border-line"
                        >
                          {BOARD_COLUMNS.map((option) => (
                            <option key={option} value={option}>
                              {STATUS_LABELS[option]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
