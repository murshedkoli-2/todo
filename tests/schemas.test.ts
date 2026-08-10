import { describe, expect, test } from "vitest";
import {
  createTodoSchema, imageUrl, todoListQuerySchema, updateTodoSchema,
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

  test("uppercases the currency code", () => {
    expect(createTodoSchema.parse({ title: "A", paymentCurrency: "usd" }).paymentCurrency)
      .toBe("USD");
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
