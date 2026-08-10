import { describe, expect, test } from "vitest";
import { getDisplayStatus, STATUS_LABELS, STATUS_TEXT_COLORS, BOARD_COLUMNS } from "@/lib/types";
import type { Todo } from "@/lib/types";

function todo(overrides: Partial<Todo>): Todo {
  return {
    _id: "1",
    title: "T",
    status: "todo",
    dueDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    userId: "u1",
    ownerName: "Me",
    images: [],
    featureImage: null,
    paymentAmountMinor: null,
    paymentCurrency: "BDT",
    paymentStatus: "unpaid",
    ...overrides,
  };
}

const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString();

describe("getDisplayStatus", () => {
  test("returns the stored status when there is no due date", () => {
    expect(getDisplayStatus(todo({ status: "in_progress" }))).toBe("in_progress");
  });

  test("derives overdue from a past due date", () => {
    expect(getDisplayStatus(todo({ dueDate: YESTERDAY }))).toBe("overdue");
  });

  test("never marks completed work overdue", () => {
    // Finishing late is still finishing; flagging it red is just noise.
    expect(getDisplayStatus(todo({ status: "completed", dueDate: YESTERDAY })))
      .toBe("completed");
  });

  test("a future due date does not change the status", () => {
    expect(getDisplayStatus(todo({ status: "todo", dueDate: TOMORROW }))).toBe("todo");
  });
});

describe("display tables", () => {
  test("every display status has a label and an ink colour", () => {
    for (const status of ["todo", "in_progress", "completed", "overdue"] as const) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      // Ink variants exist because the vivid fills fail contrast on their own
      // pale tints; a missing entry would silently ship an unreadable label.
      expect(STATUS_TEXT_COLORS[status]).toMatch(/^var\(--/);
    }
  });

  test("the board only offers real, settable statuses", () => {
    expect(BOARD_COLUMNS).toEqual(["todo", "in_progress", "completed"]);
    expect(BOARD_COLUMNS).not.toContain("overdue");
  });
});
