/**
 * The task's status as a function of its sub-tasks.
 *
 * A task that carries sub-tasks has its progress recorded twice: once in the
 * checklist, and once in the status the operator sets by hand. Asking someone
 * to keep those two in step is asking them to do bookkeeping the app already
 * has the facts for — and the failure mode is silent, because a task with
 * every leg ticked and a status of "To Do" looks exactly like real outstanding
 * work on every board, filter, and tally in the app.
 *
 * So the checklist drives the status. This module is the single statement of
 * that rule, kept pure and away from the database so it can be reasoned about
 * and tested directly — the reconciliation in `lib/subtasks.ts` has the same
 * shape and the same reason for existing.
 */

import { subtaskProgress } from "@/lib/subtasks";
import type { TaskSubtask } from "@/lib/subtasks";
import type { TodoStatus } from "@/lib/schemas/todo";

/** Every leg ticked. False for a task with no sub-tasks — nothing to finish. */
export function allSubtasksDone(subtasks: readonly TaskSubtask[]): boolean {
  const { done, total } = subtaskProgress(subtasks);
  return total > 0 && done === total;
}

/**
 * The status the checklist implies, or `null` to leave the stored one alone.
 *
 * Three transitions, and each is the answer to a question the operator would
 * otherwise have to answer twice:
 *
 * - Every leg ticked → **completed**. This is the rule people actually asked
 *   for: finishing the last sub-task *is* finishing the task.
 * - A leg untucked on a completed task → **in progress**. Without this the
 *   automation is a one-way door: reopening a leg would leave the task filed
 *   as done, which is a worse lie than the one the rule was added to fix, and
 *   the only way out would be the manual status the rule exists to remove.
 * - The first leg ticked on an untouched task → **in progress**, because that
 *   is what has just become true. Nothing moves out of "To Do" on its own
 *   otherwise, and a board whose first column holds half-finished work is not
 *   telling anyone anything.
 *
 * Everything else returns `null`. In particular a task with no sub-tasks is
 * never touched: ordinary work that is not one of the standing services still
 * has a status the operator owns outright.
 */
export function deriveStatusFromSubtasks(
  subtasks: readonly TaskSubtask[],
  currentStatus: TodoStatus
): TodoStatus | null {
  const { done, total } = subtaskProgress(subtasks);
  if (total === 0) return null;

  if (done === total) return currentStatus === "completed" ? null : "completed";

  // Not finished. Anything filed as completed is now wrong, and so is anything
  // still filed as untouched once a leg has been ticked.
  if (currentStatus === "completed") return "in_progress";
  if (currentStatus === "todo" && done > 0) return "in_progress";

  return null;
}

/**
 * Explains the rule at the point of use, so the automatic move is not a
 * surprise the operator has to reverse-engineer from a status that changed on
 * its own. Returns `null` when there is nothing to say.
 */
export function subtaskStatusHint(subtasks: readonly TaskSubtask[]): string | null {
  const { done, total } = subtaskProgress(subtasks);
  if (total === 0) return null;

  if (done === total) {
    return "Every sub-task is done, so this task completed itself. Reopen one to reopen the task.";
  }
  return `This task completes itself once all ${total} sub-tasks are ticked — ${total - done} to go.`;
}
