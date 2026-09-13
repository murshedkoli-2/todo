import { describe, expect, test } from "vitest";
import {
  allSubtasksDone, deriveStatusFromSubtasks, nextSubtaskStatus, subtaskStatusHint,
} from "@/lib/taskStatus";
import type { SubtaskStatus, TaskSubtask } from "@/lib/subtasks";
import type { TodoStatus } from "@/lib/schemas/todo";

/**
 * The status a task shows is now a consequence of its checklist rather than
 * something typed in beside it, which removes a whole class of quietly wrong
 * screens — a task with every leg ticked still filed as "To Do" is
 * indistinguishable from real outstanding work on every board and tally.
 *
 * It also introduces one: an automation that only moves in one direction. Most
 * of what follows guards the reverse transitions, because those are the ones
 * nobody thinks to check and the ones that strand a task in a status its own
 * checklist contradicts.
 */

const subtask = (
  status: SubtaskStatus,
  service: TaskSubtask["service"]
): TaskSubtask => ({ service, status, fields: {} });

const SERVICES: TaskSubtask["service"][] = [
  "new_nid", "new_passport", "police_clearance", "bmet_registration",
];

/** A checklist of `statuses.length` sub-tasks, in the states given. */
const list = (...statuses: SubtaskStatus[]): TaskSubtask[] =>
  statuses.map((status, index) => subtask(status, SERVICES[index]!));

/**
 * The same, written as ticked/unticked.
 *
 * Kept as a second spelling because most of these cases are about the two ends
 * of the range, and reading `checklist(true, false)` beside a rule about
 * completion is easier than reading two enum values.
 */
const checklist = (...flags: boolean[]): TaskSubtask[] =>
  list(...flags.map((done): SubtaskStatus => (done ? "completed" : "todo")));

describe("allSubtasksDone", () => {
  test("is true only when every leg is ticked", () => {
    expect(allSubtasksDone(checklist(true, true))).toBe(true);
    expect(allSubtasksDone(checklist(true, false))).toBe(false);
  });

  test("is false for a task with no sub-tasks — there is nothing to finish", () => {
    expect(allSubtasksDone([])).toBe(false);
  });
});

describe("deriveStatusFromSubtasks", () => {
  test("completes the task when the last sub-task is ticked", () => {
    expect(deriveStatusFromSubtasks(checklist(true, true, true), "in_progress"))
      .toBe("completed");
  });

  test("completes it from To Do as well — a task can be closed in one go", () => {
    expect(deriveStatusFromSubtasks(checklist(true), "todo")).toBe("completed");
  });

  test("leaves an already-completed task alone rather than rewriting it", () => {
    expect(deriveStatusFromSubtasks(checklist(true, true), "completed")).toBeNull();
  });

  test("reopens a completed task when a sub-task is un-ticked", () => {
    // The whole automation is a trap without this: the manual status control it
    // replaces would be the only way back out.
    expect(deriveStatusFromSubtasks(checklist(true, false), "completed"))
      .toBe("in_progress");
  });

  test("moves an untouched task along once the first leg is ticked", () => {
    expect(deriveStatusFromSubtasks(checklist(true, false, false), "todo"))
      .toBe("in_progress");
  });

  test("moves it along on a leg merely started, not only on one finished", () => {
    /* The common case on this desk: an application is lodged in the morning and
       collected days later. If only a tick moved the task, every errand in
       flight would sit in the first column until the day it was finished. */
    expect(deriveStatusFromSubtasks(list("in_progress", "todo"), "todo"))
      .toBe("in_progress");
  });

  test("leaves a To Do task alone while nothing has been started", () => {
    expect(deriveStatusFromSubtasks(checklist(false, false), "todo")).toBeNull();
  });

  test("does not complete a task whose last leg is only under way", () => {
    // "Under way" is not "done", however close it looks on a progress bar.
    expect(deriveStatusFromSubtasks(list("completed", "in_progress"), "in_progress"))
      .toBeNull();
  });

  test("reopens a completed task when a leg is set back to under way", () => {
    expect(deriveStatusFromSubtasks(list("completed", "in_progress"), "completed"))
      .toBe("in_progress");
  });

  test("leaves a part-done in-progress task alone", () => {
    expect(deriveStatusFromSubtasks(checklist(true, false), "in_progress")).toBeNull();
  });

  test("never touches a task that has no sub-tasks", () => {
    // Ordinary work that is not one of the standing services keeps a status the
    // operator owns outright.
    const statuses: TodoStatus[] = ["todo", "in_progress", "completed", "canceled"];
    for (const status of statuses) {
      expect(deriveStatusFromSubtasks([], status)).toBeNull();
    }
  });

  test("never alters a canceled task even when legs change or all complete", () => {
    expect(deriveStatusFromSubtasks(checklist(true, true), "canceled")).toBeNull();
    expect(deriveStatusFromSubtasks(checklist(true, false), "canceled")).toBeNull();
    expect(deriveStatusFromSubtasks(list("in_progress", "todo"), "canceled")).toBeNull();
  });

  test("is idempotent — applying the result again derives nothing further", () => {
    const subtasks = checklist(true, true);
    const first = deriveStatusFromSubtasks(subtasks, "todo");
    expect(first).toBe("completed");
    expect(deriveStatusFromSubtasks(subtasks, first!)).toBeNull();
  });
});

describe("nextSubtaskStatus", () => {
  test("cycles forward through the three states", () => {
    expect(nextSubtaskStatus("todo")).toBe("in_progress");
    expect(nextSubtaskStatus("in_progress")).toBe("completed");
  });

  test("wraps from done back to not started, so a mistap is one more tap", () => {
    expect(nextSubtaskStatus("completed")).toBe("todo");
  });

  test("returns to where it started after three presses", () => {
    const statuses: SubtaskStatus[] = ["todo", "in_progress", "completed"];
    for (const status of statuses) {
      expect(nextSubtaskStatus(nextSubtaskStatus(nextSubtaskStatus(status))))
        .toBe(status);
    }
  });
});

describe("subtaskStatusHint", () => {
  test("counts down what is left", () => {
    expect(subtaskStatusHint(checklist(true, false, false)))
      .toContain("2 to go");
  });

  test("says how many legs are under way, which is the state in between", () => {
    expect(subtaskStatusHint(list("in_progress", "in_progress", "todo")))
      .toContain("2 under way");
  });

  test("does not mention work under way when there is none", () => {
    expect(subtaskStatusHint(checklist(true, false))).not.toContain("under way");
  });

  test("explains the completed task, and how to reopen it", () => {
    expect(subtaskStatusHint(checklist(true, true))).toContain("Reopen");
  });

  test("says nothing when there are no sub-tasks", () => {
    expect(subtaskStatusHint([])).toBeNull();
  });
});
