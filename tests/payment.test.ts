import { describe, expect, test } from "vitest";
import { derivePaymentStatus, dueMinor, legacyPaidMinor } from "@/lib/payment";

/** Amounts are minor units — ৳13,500.00 is 1_350_000. */
const TOTAL = 1_350_000;
const HALF = 750_000;

describe("derivePaymentStatus", () => {
  test("is unpaid when nothing has been paid", () => {
    expect(derivePaymentStatus(TOTAL, 0)).toBe("unpaid");
  });

  test("is unpaid when the paid amount is missing", () => {
    expect(derivePaymentStatus(TOTAL, null)).toBe("unpaid");
    expect(derivePaymentStatus(TOTAL, undefined)).toBe("unpaid");
  });

  test("is partial between zero and the total", () => {
    expect(derivePaymentStatus(TOTAL, HALF)).toBe("partial");
  });

  test("is paid once the total is reached exactly", () => {
    expect(derivePaymentStatus(TOTAL, TOTAL)).toBe("paid");
  });

  test("treats an overpayment as settled, not as a fourth state", () => {
    expect(derivePaymentStatus(TOTAL, TOTAL + 50_000)).toBe("paid");
  });

  test("treats money received against no recorded total as settled", () => {
    expect(derivePaymentStatus(null, HALF)).toBe("paid");
    expect(derivePaymentStatus(0, HALF)).toBe("paid");
  });

  test("is unpaid when neither figure is recorded", () => {
    expect(derivePaymentStatus(null, null)).toBe("unpaid");
  });

  test("ignores a negative paid amount rather than reporting partial", () => {
    expect(derivePaymentStatus(TOTAL, -1)).toBe("unpaid");
  });
});

describe("dueMinor", () => {
  test("returns the shortfall", () => {
    expect(dueMinor(TOTAL, HALF)).toBe(600_000);
  });

  test("returns the whole total when nothing has been paid", () => {
    expect(dueMinor(TOTAL, null)).toBe(TOTAL);
  });

  test("returns zero once settled", () => {
    expect(dueMinor(TOTAL, TOTAL)).toBe(0);
  });

  test("never goes negative on an overpayment", () => {
    expect(dueMinor(TOTAL, TOTAL + 50_000)).toBe(0);
  });

  test("returns null when there is no total to owe against", () => {
    expect(dueMinor(null, HALF)).toBeNull();
  });
});

describe("legacyPaidMinor", () => {
  /*
   * Rows written before the paid field existed carry only a total and a
   * hand-set status. Reading them back has to agree with what the user meant,
   * or opening an old task would silently restate its payment.
   */
  test("reads a settled legacy row as fully paid", () => {
    expect(legacyPaidMinor(TOTAL, "paid")).toBe(TOTAL);
  });

  test("reads an unpaid legacy row as nothing received", () => {
    expect(legacyPaidMinor(TOTAL, "unpaid")).toBe(0);
  });

  test("cannot recover the figure behind a partial legacy row", () => {
    expect(legacyPaidMinor(TOTAL, "partial")).toBeNull();
  });

  test("reports no paid amount for a settled row that had no total", () => {
    expect(legacyPaidMinor(null, "paid")).toBeNull();
  });

  test("treats a missing status as unrecoverable", () => {
    expect(legacyPaidMinor(TOTAL, null)).toBeNull();
  });

  test("round-trips through derivePaymentStatus for recoverable rows", () => {
    expect(derivePaymentStatus(TOTAL, legacyPaidMinor(TOTAL, "paid"))).toBe("paid");
    expect(derivePaymentStatus(TOTAL, legacyPaidMinor(TOTAL, "unpaid"))).toBe("unpaid");
  });
});
