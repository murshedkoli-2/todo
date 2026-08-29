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
import type { SubtaskStatus, TaskSubtask } from "@/lib/subtasks";
import type { TodoStatus } from "@/lib/schemas/todo";

/**
 * The next status in the ring, for surfaces where a sub-task is one control
 * rather than three.
 *
 * A card chip has room for a tick and nothing else, so there the state is
 * cycled: not started → under way → done → not started. Kept here, beside the
 * rule the cycle feeds, so the dense surfaces and the roomy ones cannot end up
 * disagreeing about what "the next state" means.
 */
export function nextSubtaskStatus(status: SubtaskStatus): SubtaskStatus {
  if (status === "todo") return "in_progress";
  return status === "in_progress" ? "completed" : "todo";
}

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
 * - A leg reopened on a completed task → **in progress**. Without this the
 *   automation is a one-way door: reopening a leg would leave the task filed
 *   as done, which is a worse lie than the one the rule was added to fix, and
 *   the only way out would be the manual status the rule exists to remove.
 * - The first leg *started* on an untouched task → **in progress**, because
 *   that is what has just become true. Started means either value past "not
 *   started": marking one leg as under way is exactly as much a statement that
 *   the errand has begun as ticking one off is, and it is the more common of
 *   the two — most jobs are lodged long before they are collected.
 *
 * Everything else returns `null`. In particular a task with no sub-tasks is
 * never touched: ordinary work that is not one of the standing services still
 * has a status the operator owns outright.
 */
export function deriveStatusFromSubtasks(
  subtasks: readonly TaskSubtask[],
  currentStatus: TodoStatus
): TodoStatus | null {
  const { done, started, total } = subtaskProgress(subtasks);
  if (total === 0) return null;

  if (done === total) return currentStatus === "completed" ? null : "completed";

  // Not finished. Anything filed as completed is now wrong, and so is anything
  // still filed as untouched once a leg has been started.
  if (currentStatus === "completed") return "in_progress";
  if (currentStatus === "todo" && started > 0) return "in_progress";

  return null;
}

/**
 * Explains the rule at the point of use, so the automatic move is not a
 * surprise the operator has to reverse-engineer from a status that changed on
 * its own. Returns `null` when there is nothing to say.
 */
export function subtaskStatusHint(subtasks: readonly TaskSubtask[]): string | null {
  const { done, inProgress, total } = subtaskProgress(subtasks);
  if (total === 0) return null;

  if (done === total) {
    return "Every sub-task is done, so this task completed itself. Reopen one to reopen the task.";
  }

  const remaining = `${total - done} to go`;
  /* The in-progress count is worth a clause of its own: it is the difference
     between a task nobody has touched and one that is sitting at a counter
     somewhere, and that is the distinction the third state was added for. */
  const underway = inProgress > 0 ? `, ${inProgress} under way` : "";

  return `This task completes itself once all ${total} sub-tasks are done — ${remaining}${underway}.`;
}
