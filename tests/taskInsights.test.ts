import { describe, expect, test } from "vitest";
import { countOverdue, tallyByStatus } from "@/lib/taskInsights";
import type { Todo } from "@/lib/types";

function todo(overrides: Partial<Todo>): Todo {
  return {
    _id: "1",
    title: "Task",
    status: "todo",
    priority: "none",
    dueDate: null,
    services: [],
    subtasks: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    userId: "u1",
    ownerName: "Me",
    images: [],
    featureImage: null,
    paymentAmountMinor: null,
    initialPaymentMinor: null,
    paidAmountMinor: null,
    dueAmountMinor: null,
    installments: [],
    paymentCurrency: "BDT",
    paymentMethod: "unset",
    paymentStatus: "unpaid",
    ...overrides,
  };
}

describe("task insights", () => {
  test("keeps overdue work in its workflow status and counts overdue separately", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const todos = [
      todo({ status: "todo", dueDate: yesterday }),
      todo({ status: "in_progress", dueDate: yesterday }),
      todo({ status: "completed", dueDate: yesterday }),
    ];

    expect(tallyByStatus(todos)).toEqual({
      todo: 1,
      in_progress: 1,
      completed: 1,
      canceled: 0,
    });
    expect(countOverdue(todos)).toBe(2);
  });
});
