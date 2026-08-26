import { describe, expect, test } from "vitest";
import {
  createTodoSchema, imageUrl, taskServiceList, TASK_SERVICES,
  todoListQuerySchema, updateTodoSchema,
} from "@/lib/schemas/todo";
import { createEntrySchema, createPersonSchema } from "@/lib/schemas/ledger";
import { createAccountSchema, createTxSchema } from "@/lib/schemas/wallet";
import { registerSchema, resetPasswordSchema } from "@/lib/schemas/auth";
import { positiveAmount } from "@/lib/schemas/common";

describe("positiveAmount", () => {
  test("transforms major units into integer minor units", () => {
    expect(positiveAmount.parse("12.34")).toBe(1234);
    expect(positiveAmount.parse(7)).toBe(700);
  });

  test("rejects zero and negatives", () => {
    expect(positiveAmount.safeParse(0).success).toBe(false);
    expect(positiveAmount.safeParse(-1).success).toBe(false);
  });

  test("rejects non-numeric text", () => {
    expect(positiveAmount.safeParse("free").success).toBe(false);
  });
});

describe("imageUrl", () => {
  test("accepts the configured image host", () => {
    expect(imageUrl.safeParse("https://i.ibb.co/abc/pic.png").success).toBe(true);
  });

  test("rejects an arbitrary host", () => {
    // This is the hole that let any attacker-supplied string reach next/image.
    expect(imageUrl.safeParse("https://evil.example.com/x.png").success).toBe(false);
  });

  test("rejects non-HTTPS and non-URL values", () => {
    expect(imageUrl.safeParse("http://i.ibb.co/x.png").success).toBe(false);
    expect(imageUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(imageUrl.safeParse("not a url").success).toBe(false);
  });
});

describe("createTodoSchema", () => {
  test("applies defaults for everything but the title", () => {
    const parsed = createTodoSchema.parse({ title: "  Ship it  " });
    expect(parsed).toMatchObject({
      title: "Ship it",
      status: "todo",
      images: [],
      paymentCurrency: "BDT",
      paymentStatus: "unpaid",
    });
  });

  test("rejects an empty or whitespace-only title", () => {
    expect(createTodoSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  test("converts the payment amount to minor units", () => {
    const parsed = createTodoSchema.parse({ title: "A", paymentAmount: "99.99" });
    expect(parsed.paymentAmount).toBe(9999);
  });

  test("converts the paid amount to minor units", () => {
    const parsed = createTodoSchema.parse({ title: "A", paidAmount: "75.50" });
    expect(parsed.paidAmount).toBe(7550);
  });

  test("rejects a negative paid amount", () => {
    expect(createTodoSchema.safeParse({ title: "A", paidAmount: "-1" }).success).toBe(false);
  });

  test("defaults the payment method to unset", () => {
    expect(createTodoSchema.parse({ title: "A" }).paymentMethod).toBe("unset");
  });

  test("accepts a known payment method and rejects an invented one", () => {
    expect(createTodoSchema.parse({ title: "A", paymentMethod: "bkash" }).paymentMethod)
      .toBe("bkash");
    expect(createTodoSchema.safeParse({ title: "A", paymentMethod: "paypal" }).success)
      .toBe(false);
  });

  test("uppercases the currency code", () => {
    expect(createTodoSchema.parse({ title: "A", paymentCurrency: "usd" }).paymentCurrency)
      .toBe("USD");
  });

  test("defaults to no services", () => {
    expect(createTodoSchema.parse({ title: "A" }).services).toEqual([]);
  });

  test("accepts several services on one task", () => {
    // The whole point of the field: one customer, two errands, one task.
    const parsed = createTodoSchema.parse({
      title: "A",
      services: ["new_nid", "police_clearance"],
    });
    expect(parsed.services).toEqual(["new_nid", "police_clearance"]);
  });

  test("rejects a service outside the catalogue", () => {
    expect(createTodoSchema.safeParse({ title: "A", services: ["driving_licence"] }).success)
      .toBe(false);
  });
});

describe("subtask validation", () => {
  test("defaults to no sub-tasks", () => {
    expect(createTodoSchema.parse({ title: "A" }).subtasks).toEqual([]);
  });

  test("accepts a sub-task carrying its service's fields", () => {
    const parsed = createTodoSchema.parse({
      title: "A",
      services: ["birth_certificate_correction"],
      subtasks: [
        {
          service: "birth_certificate_correction",
          done: true,
          fields: { birth_number: "19998812345678901", date_of_birth: "1999-08-12" },
        },
      ],
    });
    expect(parsed.subtasks[0].fields.birth_number).toBe("19998812345678901");
    expect(parsed.subtasks[0].done).toBe(true);
  });

  test("defaults done and fields so a bare tick is valid", () => {
    const parsed = createTodoSchema.parse({
      title: "A",
      services: ["new_nid"],
      subtasks: [{ service: "new_nid" }],
    });
    expect(parsed.subtasks[0]).toEqual({ service: "new_nid", done: false, fields: {} });
  });

  test("rejects a sub-task for a service outside the catalogue", () => {
    const result = createTodoSchema.safeParse({
      title: "A",
      subtasks: [{ service: "driving_licence" }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects an unknown key on the sub-task itself", () => {
    // `.strict()` here, unlike the field map, because the sub-task shape is
    // fixed — an extra key is a caller bug, not a catalogue that moved on.
    const result = createTodoSchema.safeParse({
      title: "A",
      subtasks: [{ service: "new_nid", notes: "x" }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects a field value long enough to bloat a document", () => {
    const result = createTodoSchema.safeParse({
      title: "A",
      subtasks: [{ service: "new_nid", fields: { applicant_name: "x".repeat(5000) } }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects a non-string field value", () => {
    const result = createTodoSchema.safeParse({
      title: "A",
      subtasks: [{ service: "new_nid", fields: { applicant_name: { $ne: null } } }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects more sub-tasks than there are services", () => {
    const flood = Array.from({ length: TASK_SERVICES.length + 1 }, () => ({
      service: "new_nid",
    }));
    expect(createTodoSchema.safeParse({ title: "A", subtasks: flood }).success).toBe(false);
  });

  test("accepts an empty sub-task array so a selection can be cleared", () => {
    expect(updateTodoSchema.parse({ subtasks: [] }).subtasks).toEqual([]);
  });
});

describe("taskServiceList", () => {
  test("drops a repeated selection rather than rejecting it", () => {
    // A double-tap on a chip is a slip, not an error worth failing the save.
    expect(taskServiceList.parse(["new_nid", "new_nid"])).toEqual(["new_nid"]);
  });

  test("sorts into catalogue order however the chips were tapped", () => {
    // Two tasks holding the same work must render the same chips in the same
    // places, whichever order the counter clerk picked them in.
    expect(taskServiceList.parse(["police_clearance", "birth_certificate", "new_nid"]))
      .toEqual(["birth_certificate", "new_nid", "police_clearance"]);
  });

  test("accepts the whole catalogue at once", () => {
    expect(taskServiceList.parse([...TASK_SERVICES])).toEqual([...TASK_SERVICES]);
  });

  test("caps a hostile payload before the dedupe allocates", () => {
    const flood = Array.from({ length: 51 }, () => "new_nid");
    expect(taskServiceList.safeParse(flood).success).toBe(false);
  });

  test("rejects a non-array value", () => {
    expect(taskServiceList.safeParse("new_nid").success).toBe(false);
  });
});

describe("updateTodoSchema", () => {
  test("rejects unknown keys instead of silently ignoring them", () => {
    // `.strict()` is what stops arbitrary fields reaching the document.
    const result = updateTodoSchema.safeParse({ title: "A", isAdmin: true });
    expect(result.success).toBe(false);
  });

  test("rejects an empty patch", () => {
    expect(updateTodoSchema.safeParse({}).success).toBe(false);
  });

  test("keeps an explicit null so the service can unset the field", () => {
    const parsed = updateTodoSchema.parse({ dueDate: null });
    expect("dueDate" in parsed).toBe(true);
    expect(parsed.dueDate).toBeNull();
  });

  test("rejects a non-array images value", () => {
    // Previously `todo.images = images` accepted whatever arrived.
    expect(updateTodoSchema.safeParse({ images: "not-an-array" }).success).toBe(false);
    expect(updateTodoSchema.safeParse({ images: { $ne: null } }).success).toBe(false);
  });

  test("caps the number of images", () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `https://i.ibb.co/x/${i}.png`);
    expect(updateTodoSchema.safeParse({ images: tooMany }).success).toBe(false);
  });

  test("accepts an empty services array so a selection can be cleared", () => {
    // Distinct from omitting the key: `[]` means "this task has no services
    // any more", which the service layer has to write rather than skip.
    const parsed = updateTodoSchema.parse({ services: [] });
    expect(parsed.services).toEqual([]);
  });

  test("rejects a service outside the catalogue", () => {
    expect(updateTodoSchema.safeParse({ services: ["visa"] }).success).toBe(false);
  });
});

describe("todoListQuerySchema", () => {
  test("coerces query strings and applies defaults", () => {
    expect(todoListQuerySchema.parse({})).toEqual({ page: 1, limit: 50 });
    expect(todoListQuerySchema.parse({ page: "3", limit: "10" }))
      .toMatchObject({ page: 3, limit: 10 });
  });

  test("caps the page size so a single request cannot scan everything", () => {
    expect(todoListQuerySchema.safeParse({ limit: "5000" }).success).toBe(false);
  });

  test("accepts a service filter and rejects an unknown one", () => {
    expect(todoListQuerySchema.parse({ service: "new_passport" }).service)
      .toBe("new_passport");
    expect(todoListQuerySchema.safeParse({ service: "trade_licence" }).success)
      .toBe(false);
  });
});

describe("ledger schemas", () => {
  test("createPersonSchema converts the opening balance", () => {
    const parsed = createPersonSchema.parse({ name: "Rahim", initialAmount: "250.50" });
    expect(parsed.initialAmount).toBe(25050);
    expect(parsed.initialType).toBe("receivable");
  });

  test("createEntrySchema rejects an unknown entry type", () => {
    expect(createEntrySchema.safeParse({ type: "gift", amount: 5 }).success).toBe(false);
  });

  test("createEntrySchema rejects a zero amount", () => {
    expect(createEntrySchema.safeParse({ type: "payable", amount: 0 }).success).toBe(false);
  });

  test("createEntrySchema parses a YYYY-MM-DD date input", () => {
    const parsed = createEntrySchema.parse({
      type: "receivable", amount: 1, date: "2026-03-01",
    });
    expect(parsed.date).toBeInstanceOf(Date);
  });

  test("createEntrySchema rejects an unparseable date", () => {
    expect(
      createEntrySchema.safeParse({ type: "receivable", amount: 1, date: "yesterday" }).success
    ).toBe(false);
  });
});

describe("wallet schemas", () => {
  test("createAccountSchema defaults the opening balance to zero", () => {
    const parsed = createAccountSchema.parse({ name: "Cash", accountType: "cash" });
    expect(parsed.initialBalance).toBe(0);
  });

  test("createAccountSchema allows a zero opening balance but not a negative one", () => {
    expect(
      createAccountSchema.safeParse({ name: "C", accountType: "cash", initialBalance: -5 }).success
    ).toBe(false);
  });

  test("createAccountSchema rejects a malformed colour", () => {
    expect(
      createAccountSchema.safeParse({ name: "C", accountType: "cash", color: "red" }).success
    ).toBe(false);
    expect(
      createAccountSchema.safeParse({ name: "C", accountType: "cash", color: "#4f5ee8" }).success
    ).toBe(true);
  });

  test("createTxSchema requires a known direction", () => {
    expect(createTxSchema.safeParse({ type: "refund", amount: 1 }).success).toBe(false);
    expect(createTxSchema.parse({ type: "debit", amount: "3.50" }).amount).toBe(350);
  });
});

describe("auth schemas", () => {
  test("registerSchema normalises the email", () => {
    const parsed = registerSchema.parse({
      name: "  Jane  ", email: "  JANE@Example.COM ", password: "correct horse",
    });
    expect(parsed.email).toBe("jane@example.com");
    expect(parsed.name).toBe("Jane");
  });

  test("registerSchema enforces the eight-character floor", () => {
    const short = { name: "Jane", email: "a@b.co", password: "1234567" };
    expect(registerSchema.safeParse(short).success).toBe(false);
  });

  test("resetPasswordSchema requires exactly six digits", () => {
    const base = { email: "a@b.co", password: "longenough1" };
    expect(resetPasswordSchema.safeParse({ ...base, code: "12345" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ ...base, code: "abcdef" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ ...base, code: "123456" }).success).toBe(true);
  });
});
