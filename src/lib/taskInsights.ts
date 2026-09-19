/**
 * Read-only summaries derived from a list of tasks.
 *
 * The overview and the task list both need these, and computing them twice in
 * two components is how the header count and the page below it end up
 * disagreeing. Pure functions over the DTO, so they are testable without a
 * render.
 */

import { getDisplayStatus } from "@/lib/types";
import type { Todo } from "@/lib/types";
import type { TodoStatus } from "@/lib/schemas/todo";

export type StatusTally = Record<TodoStatus, number>;

/** How many tasks sit in each real, settable workflow status. */
export function tallyByStatus(todos: ReadonlyArray<Todo>): StatusTally {
  const tally: StatusTally = { todo: 0, in_progress: 0, completed: 0, canceled: 0 };
  for (const todo of todos) tally[todo.status] += 1;
  return tally;
}

/** Overdue is a deadline condition, not a workflow status. */
export function countOverdue(todos: ReadonlyArray<Todo>): number {
  return todos.filter((todo) => getDisplayStatus(todo) === "overdue").length;
}

/**
 * The one task worth surfacing above everything else: the soonest deadline
 * still open, overdue first. Returns `null` when nothing open carries a date —
 * an arbitrary "next" task would be worse than none.
 */
export function pickFocusTask(todos: ReadonlyArray<Todo>): Todo | null {
  const dated = todos.filter(
    (todo) => todo.status !== "completed" && todo.status !== "canceled" && todo.dueDate
  );
  if (dated.length === 0) return null;

  return [...dated].sort(
    (a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
  )[0]!;
}

/** Total still owed across every task that records a payment. */
export function outstandingMinor(todos: ReadonlyArray<Todo>): number {
  return todos.reduce((sum, todo) => sum + (todo.dueAmountMinor ?? 0), 0);
}
