import { describe, expect, test } from "vitest";
import {
  SECRET_MASK,
  describeSubtaskFields,
  isSubtaskDone,
  isSubtaskStarted,
  missingFieldCount,
  normalizeFields,
  normalizeSubtasks,
  readSubtasks,
  redactSecrets,
  resolveSubtaskStatus,
  subtaskProgress,
  toStoredSubtasks,
} from "@/lib/subtasks";
import type { TaskSubtask } from "@/lib/subtasks";
import {
  MAX_FIELD_LENGTH, SERVICE_FIELDS, TASK_SERVICES, fieldDef, hasSecretField,
} from "@/lib/serviceCatalogue";

/**
 * The reconciliation between `services` and `subtasks` is the whole risk in
 * this feature. Two fields hold one fact, and every way they can disagree —
 * a row for an unticked job, a ticked job with no row, a field key that is not
 * in the catalogue, a credential riding along on a list response — is a bug
 * that type checking cannot see and that renders as a plausible-looking screen.
 */

const subtask = (overrides: Partial<TaskSubtask> = {}): TaskSubtask => ({
  service: "nid_correction",
  status: "todo",
  fields: {},
  ...overrides,
});

describe("the catalogue", () => {
  test("asks for a birth number and a date of birth on a birth correction", () => {
    expect(SERVICE_FIELDS.birth_certificate_correction.map((f) => f.key))
      .toEqual(["birth_number", "date_of_birth"]);
  });

  test("asks for a password on a NID correction, and marks it secret", () => {
    expect(fieldDef("nid_correction", "password")?.type).toBe("secret");
    expect(hasSecretField("nid_correction")).toBe(true);
  });

  test("no other service asks for a credential", () => {
    const withSecrets = TASK_SERVICES.filter(hasSecretField);
    expect(withSecrets).toEqual(["nid_correction"]);
  });

  test("every service defines at least one field, so no tick opens a blank card", () => {
    for (const service of TASK_SERVICES) {
      expect(SERVICE_FIELDS[service].length).toBeGreaterThan(0);
    }
  });

  test("field keys are unique within a service", () => {
    for (const service of TASK_SERVICES) {
      const keys = SERVICE_FIELDS[service].map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("normalizeFields", () => {
  test("keeps only the keys the service defines", () => {
    const fields = normalizeFields("birth_certificate_correction", {
      birth_number: "19998812345678901",
      // Belongs to a different service; a client that sent it is confused.
      passport_number: "BX0912345",
    });
    expect(fields).toEqual({ birth_number: "19998812345678901" });
  });

  test("trims, and drops a value that was only whitespace", () => {
    const fields = normalizeFields("birth_certificate_correction", {
      birth_number: "  19998812345678901  ",
      date_of_birth: "   ",
    });
    expect(fields).toEqual({ birth_number: "19998812345678901" });
  });

  test("caps a value rather than rejecting the whole sub-task", () => {
    const fields = normalizeFields("training_admission", {
      course_name: "x".repeat(MAX_FIELD_LENGTH + 50),
    });
    expect(fields.course_name).toHaveLength(MAX_FIELD_LENGTH);
  });

  test("ignores a non-string value", () => {
    const fields = normalizeFields("training_admission", {
      course_name: { toString: () => "injected" } as unknown as string,
    });
    expect(fields).toEqual({});
  });

  test("reads the stored pair-array shape as well as a client map", () => {
    const fields = normalizeFields("passport_correction", [
      { key: "passport_number", value: "BX0912345" },
    ]);
    expect(fields).toEqual({ passport_number: "BX0912345" });
  });
});

describe("normalizeSubtasks", () => {
  test("gives every ticked service a row, even one with nothing filled in", () => {
    const { subtasks } = normalizeSubtasks(["police_clearance", "new_nid"], []);
    expect(subtasks.map((s) => s.service)).toEqual(["new_nid", "police_clearance"]);
    expect(subtasks.every((s) => Object.keys(s.fields).length === 0)).toBe(true);
  });

  test("discards a row whose service was unticked", () => {
    // The exact drift the two-field storage risks: the user removes the NID
    // correction but the form still carries the password it collected.
    const { services, subtasks } = normalizeSubtasks(
      ["new_passport"],
      [
        subtask({ service: "nid_correction", fields: { password: "hunter2" } }),
        subtask({ service: "new_passport" }),
      ]
    );
    expect(services).toEqual(["new_passport"]);
    expect(subtasks).toHaveLength(1);
    expect(JSON.stringify(subtasks)).not.toContain("hunter2");
  });

  test("returns rows in catalogue order however they were tapped", () => {
    const { services, subtasks } = normalizeSubtasks(
      ["training_admission", "birth_certificate", "nid_correction"],
      []
    );
    const expected = ["birth_certificate", "nid_correction", "training_admission"];
    expect(services).toEqual(expected);
    expect(subtasks.map((s) => s.service)).toEqual(expected);
  });

  test("services and subtasks always line up element for element", () => {
    const { services, subtasks } = normalizeSubtasks([...TASK_SERVICES], []);
    expect(subtasks.map((s) => s.service)).toEqual(services);
  });

  test("drops a duplicated service, keeping the last row", () => {
    const { subtasks } = normalizeSubtasks(
      ["passport_correction"],
      [
        subtask({ service: "passport_correction", fields: { passport_number: "OLD" } }),
        subtask({ service: "passport_correction", fields: { passport_number: "NEW" } }),
      ]
    );
    expect(subtasks).toHaveLength(1);
    expect(subtasks[0].fields.passport_number).toBe("NEW");
  });

  test("ignores a service that is not in the catalogue", () => {
    /* Written as a raw input rather than through the helper: `SubtaskInput`
       takes a plain string, which is exactly the point — a service retired from
       the catalogue is still sitting in rows the database wrote earlier. */
    const { services, subtasks } = normalizeSubtasks(
      ["new_nid", "trade_licence"],
      [{ service: "trade_licence", status: "todo", fields: { anything: "x" } }]
    );
    expect(services).toEqual(["new_nid"]);
    expect(subtasks.map((s) => s.service)).toEqual(["new_nid"]);
  });

  test("treats a row with no status at all as not started", () => {
    const { subtasks } = normalizeSubtasks(
      ["new_nid"],
      [{ service: "new_nid", status: null, done: null, fields: null }]
    );
    expect(subtasks[0].status).toBe("todo");
  });

  test("keeps a row that is under way as under way", () => {
    // The state the boolean could not hold, and the reason for the change: a
    // job that has been lodged is neither untouched nor finished.
    const { subtasks } = normalizeSubtasks(
      ["new_passport"],
      [{ service: "new_passport", status: "in_progress" }]
    );
    expect(subtasks[0].status).toBe("in_progress");
  });

  test("ignores a status that is not one of the three", () => {
    const { subtasks } = normalizeSubtasks(
      ["new_nid"],
      [{ service: "new_nid", status: "collected" }]
    );
    expect(subtasks[0].status).toBe("todo");
  });
});

describe("resolveSubtaskStatus", () => {
  /*
   * Every sub-task written before this feature carries `done` and no `status`,
   * and there is no migration script — the mapping runs on every read instead.
   * If it is wrong, a whole collection of finished work silently reopens.
   */
  test("maps a pre-existing ticked row onto completed", () => {
    expect(resolveSubtaskStatus(undefined, true)).toBe("completed");
  });

  test("maps a pre-existing unticked row onto not started", () => {
    expect(resolveSubtaskStatus(undefined, false)).toBe("todo");
  });

  test("prefers the status when a row carries both", () => {
    // A row rewritten after the change may still have the old key sitting on
    // it; the new field is the one that was actually set.
    expect(resolveSubtaskStatus("in_progress", true)).toBe("in_progress");
  });

  test("reads a legacy ticked row back through the normalizer", () => {
    const { subtasks } = normalizeSubtasks(
      ["police_clearance"],
      [{ service: "police_clearance", done: true }]
    );
    expect(subtasks[0].status).toBe("completed");
  });
});

describe("isSubtaskDone / isSubtaskStarted", () => {
  test("only completed counts as done", () => {
    expect(isSubtaskDone(subtask({ status: "completed" }))).toBe(true);
    expect(isSubtaskDone(subtask({ status: "in_progress" }))).toBe(false);
    expect(isSubtaskDone(subtask({ status: "todo" }))).toBe(false);
  });

  test("anything past not-started counts as started", () => {
    expect(isSubtaskStarted(subtask({ status: "in_progress" }))).toBe(true);
    expect(isSubtaskStarted(subtask({ status: "completed" }))).toBe(true);
    expect(isSubtaskStarted(subtask({ status: "todo" }))).toBe(false);
  });
});

describe("readSubtasks", () => {
  test("gives a task written before sub-tasks existed a row per service", () => {
    // Otherwise the checklist renders empty on every pre-existing task, which
    // reads as "no services selected" rather than "nothing captured yet".
    const { subtasks } = readSubtasks(["new_passport", "police_clearance"], undefined);
    expect(subtasks.map((s) => s.service)).toEqual(["new_passport", "police_clearance"]);
  });

  test("survives a service retired from the catalogue after it was stored", () => {
    const { services, subtasks } = readSubtasks(["new_nid", "trade_licence"], [
      { service: "trade_licence", status: "completed", fields: [{ key: "x", value: "y" }] },
    ]);
    expect(services).toEqual(["new_nid"]);
    expect(subtasks).toHaveLength(1);
  });
});

describe("toStoredSubtasks", () => {
  test("writes fields in catalogue order regardless of insertion order", () => {
    // Two saves of the same values must produce identical documents, or a
    // no-op edit shows up as a change.
    const a = toStoredSubtasks([
      subtask({
        service: "birth_certificate_correction",
        fields: { date_of_birth: "1999-01-02", birth_number: "1999" },
      }),
    ]);
    const b = toStoredSubtasks([
      subtask({
        service: "birth_certificate_correction",
        fields: { birth_number: "1999", date_of_birth: "1999-01-02" },
      }),
    ]);
    expect(a).toEqual(b);
    expect(a[0].fields.map((f) => f.key)).toEqual(["birth_number", "date_of_birth"]);
  });

  test("round-trips through storage without losing anything", () => {
    const original = normalizeSubtasks(
      ["nid_correction", "training_admission"],
      [
        subtask({ service: "nid_correction", status: "completed", fields: { nid_number: "123", password: "s3cret" } }),
        subtask({ service: "training_admission", fields: { course_name: "Welding" } }),
      ]
    ).subtasks;

    const restored = readSubtasks(
      original.map((s) => s.service),
      toStoredSubtasks(original)
    ).subtasks;

    expect(restored).toEqual(original);
  });

  test("omits a blank field entirely rather than storing an empty string", () => {
    const stored = toStoredSubtasks([
      subtask({ service: "new_nid", fields: { applicant_name: "Rahim" } }),
    ]);
    expect(stored[0].fields).toEqual([{ key: "applicant_name", value: "Rahim" }]);
  });
});

describe("subtaskProgress", () => {
  test("tallies the three states separately", () => {
    expect(
      subtaskProgress([
        subtask({ service: "new_nid", status: "completed" }),
        subtask({ service: "new_passport", status: "in_progress" }),
        subtask({ service: "police_clearance", status: "completed" }),
        subtask({ service: "training_admission", status: "todo" }),
      ])
    ).toEqual({ todo: 1, inProgress: 1, done: 2, started: 3, total: 4 });
  });

  test("counts a leg that is merely under way as started but not done", () => {
    // The distinction the whole feature rests on — and the one that decides
    // whether a task leaves "To Do" without being finished.
    const progress = subtaskProgress([subtask({ status: "in_progress" })]);
    expect(progress.done).toBe(0);
    expect(progress.started).toBe(1);
  });

  test("reports nothing of nothing for a task with no services", () => {
    expect(subtaskProgress([]))
      .toEqual({ todo: 0, inProgress: 0, done: 0, started: 0, total: 0 });
  });
});

describe("missingFieldCount", () => {
  test("counts the catalogue fields still blank", () => {
    expect(missingFieldCount(subtask({ service: "birth_certificate_correction" }))).toBe(2);
    expect(
      missingFieldCount(
        subtask({ service: "birth_certificate_correction", fields: { birth_number: "1999" } })
      )
    ).toBe(1);
  });
});

describe("describeSubtaskFields", () => {
  test("masks a credential by default", () => {
    const described = describeSubtaskFields(
      subtask({ service: "nid_correction", fields: { nid_number: "123", password: "s3cret" } })
    );
    expect(described.map((f) => f.value)).toEqual(["123", SECRET_MASK]);
    expect(described.find((f) => f.key === "password")?.secret).toBe(true);
  });

  test("reveals it only when asked explicitly", () => {
    const described = describeSubtaskFields(
      subtask({ service: "nid_correction", fields: { password: "s3cret" } }),
      { revealSecrets: true }
    );
    expect(described[0].value).toBe("s3cret");
  });

  test("leaves out fields that were never filled in", () => {
    expect(describeSubtaskFields(subtask({ service: "new_nid" }))).toEqual([]);
  });

  test("prints fields in catalogue order", () => {
    const described = describeSubtaskFields(
      subtask({
        service: "birth_certificate_correction",
        fields: { date_of_birth: "1999-01-02", birth_number: "1999" },
      })
    );
    expect(described.map((f) => f.key)).toEqual(["birth_number", "date_of_birth"]);
  });
});

describe("redactSecrets", () => {
  test("removes the credential and keeps everything else", () => {
    const [row] = redactSecrets([
      subtask({ service: "nid_correction", fields: { nid_number: "123", password: "s3cret" } }),
    ]);
    expect(row.fields).toEqual({ nid_number: "123" });
  });

  test("leaves a row with no credential untouched by identity", () => {
    // Cheap enough to matter: the list endpoint runs this over every task.
    const rows = [subtask({ service: "new_passport", fields: { nid_number: "123" } })];
    expect(redactSecrets(rows)[0]).toBe(rows[0]);
  });

  test("no credential survives anywhere in the redacted payload", () => {
    const rows = redactSecrets([
      subtask({ service: "nid_correction", status: "completed", fields: { password: "s3cret" } }),
      subtask({ service: "new_nid", fields: { applicant_name: "Rahim" } }),
    ]);
    expect(JSON.stringify(rows)).not.toContain("s3cret");
    expect(JSON.stringify(rows)).toContain("Rahim");
  });
});
