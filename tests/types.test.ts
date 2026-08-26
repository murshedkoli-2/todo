import { describe, expect, test } from "vitest";
import {
  getDisplayStatus, STATUS_LABELS, STATUS_TEXT_COLORS, BOARD_COLUMNS,
  SERVICE_CHOICES, SERVICE_LABELS, SERVICE_SHORT_LABELS, SERVICE_DESCRIPTIONS,
  SERVICE_COLORS, SERVICE_TEXT_COLORS, SERVICE_ON_COLORS, formatServices,
} from "@/lib/types";
import { TASK_SERVICES } from "@/lib/schemas/todo";
import type { Todo } from "@/lib/types";

function todo(overrides: Partial<Todo>): Todo {
  return {
    _id: "1",
    title: "T",
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
    paidAmountMinor: null,
    dueAmountMinor: null,
    paymentCurrency: "BDT",
    paymentMethod: "unset",
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

describe("service display tables", () => {
  /* Each table is keyed by the enum, so a service added to the catalogue and
     forgotten here is a type error rather than a blank chip — but only if the
     tables stay exhaustive, which a `Record` cannot enforce at runtime for a
     value read out of the database. */
  const TABLES = {
    SERVICE_LABELS,
    SERVICE_SHORT_LABELS,
    SERVICE_DESCRIPTIONS,
    SERVICE_COLORS,
    SERVICE_TEXT_COLORS,
    SERVICE_ON_COLORS,
  };

  test.each(Object.entries(TABLES))("%s covers every catalogue service", (_name, table) => {
    expect(Object.keys(table).sort()).toEqual([...TASK_SERVICES].sort());
  });

  test("offers every service in catalogue order", () => {
    expect(SERVICE_CHOICES).toEqual([...TASK_SERVICES]);
  });

  /* Spelled out rather than compared against the enum, which is the point: this
     is the list the desk agreed on, and it fails if a service is quietly
     dropped or reordered away from its "new"/"correction" partner. */
  test("the nine standing jobs are all offered, correction beside its original", () => {
    expect(SERVICE_CHOICES).toEqual([
      "birth_certificate", "birth_certificate_correction",
      "new_nid", "nid_correction",
      "new_passport", "passport_correction",
      "police_clearance", "bmet_registration", "training_admission",
    ]);
  });

  test("short labels stay short enough for a card chip", () => {
    for (const service of SERVICE_CHOICES) {
      expect(SERVICE_SHORT_LABELS[service].length).toBeLessThanOrEqual(13);
    }
  });
});

describe("formatServices", () => {
  test("joins the labels in the order given", () => {
    expect(formatServices(["new_nid", "police_clearance"]))
      .toBe("New NID, Police Clearance");
  });

  test("renders a task with no services as an empty string", () => {
    // The callers branch on `.length`, so this must not read as "None".
    expect(formatServices([])).toBe("");
  });
});
