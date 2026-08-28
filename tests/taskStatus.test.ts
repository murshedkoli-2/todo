import { describe, expect, test } from "vitest";
import {
  allSubtasksDone, deriveStatusFromSubtasks, subtaskStatusHint,
} from "@/lib/taskStatus";
import type { TaskSubtask } from "@/lib/subtasks";
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

const subtask = (done: boolean, service: TaskSubtask["service"]): TaskSubtask => ({
  service,
  done,
  fields: {},
});

/** A checklist of `flags.length` sub-tasks, ticked as given. */
const checklist = (...flags: boolean[]): TaskSubtask[] => {
  const services: TaskSubtask["service"][] = [
    "new_nid", "new_passport", "police_clearance", "bmet_registration",
  ];
  return flags.map((done, index) => subtask(done, services[index]!));
};

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

  test("leaves a To Do task alone while nothing has been ticked", () => {
    expect(deriveStatusFromSubtasks(checklist(false, false), "todo")).toBeNull();
  });

  test("leaves a part-done in-progress task alone", () => {
    expect(deriveStatusFromSubtasks(checklist(true, false), "in_progress")).toBeNull();
  });

  test("never touches a task that has no sub-tasks", () => {
    // Ordinary work that is not one of the standing services keeps a status the
    // operator owns outright.
    const statuses: TodoStatus[] = ["todo", "in_progress", "completed"];
    for (const status of statuses) {
      expect(deriveStatusFromSubtasks([], status)).toBeNull();
    }
  });

  test("is idempotent — applying the result again derives nothing further", () => {
    const subtasks = checklist(true, true);
    const first = deriveStatusFromSubtasks(subtasks, "todo");
    expect(first).toBe("completed");
    expect(deriveStatusFromSubtasks(subtasks, first!)).toBeNull();
  });
});

describe("subtaskStatusHint", () => {
  test("counts down what is left", () => {
    expect(subtaskStatusHint(checklist(true, false, false)))
      .toContain("2 to go");
  });

  test("explains the completed task, and how to reopen it", () => {
    expect(subtaskStatusHint(checklist(true, true))).toContain("Reopen");
  });

  test("says nothing when there are no sub-tasks", () => {
    expect(subtaskStatusHint([])).toBeNull();
  });
});
