import { describe, expect, test } from "vitest";
import {
  currencySymbol, formatMoney, fromMinor, MAX_MINOR, minorFactor,
  readMinor, sumMinor, toMinor,
} from "@/lib/money";

describe("toMinor", () => {
  test("converts a whole major unit to minor units", () => {
    expect(toMinor(10)).toBe(1000);
  });

  test("rounds rather than truncates the IEEE-754 scaling error", () => {
    // 2.99 * 100 is 298.99999999999994 in binary floating point; truncating
    // would silently lose a paisa on a large fraction of real inputs.
    expect(toMinor(2.99)).toBe(299);
    expect(toMinor(1.1)).toBe(110);
    expect(toMinor(8.29)).toBe(829);
  });

  test("accepts the string an <input type=number> actually sends", () => {
    expect(toMinor("  12.34  ")).toBe(1234);
  });

  test("returns null for empty and nullish input rather than defaulting to zero", () => {
    expect(toMinor("")).toBeNull();
    expect(toMinor(null)).toBeNull();
    expect(toMinor(undefined)).toBeNull();
  });

  test("returns null for values that are not finite numbers", () => {
    expect(toMinor("abc")).toBeNull();
    expect(toMinor(Number.NaN)).toBeNull();
    expect(toMinor(Number.POSITIVE_INFINITY)).toBeNull();
  });

  test("rejects amounts beyond the safe-integer ceiling", () => {
    expect(toMinor(MAX_MINOR)).toBeNull();
  });

  test("preserves sign for negative amounts", () => {
    expect(toMinor(-4.5)).toBe(-450);
  });
});

describe("fromMinor", () => {
  test("round-trips through toMinor", () => {
    expect(fromMinor(toMinor(1234.56)!)).toBe(1234.56);
  });
});

describe("sumMinor", () => {
  test("sums exactly where floating point would drift", () => {
    // 0.1 + 0.2 !== 0.3 in float; as integers this is unconditionally exact.
    const amounts = [toMinor(0.1)!, toMinor(0.2)!];
    expect(sumMinor(amounts)).toBe(30);
    expect(fromMinor(sumMinor(amounts))).toBe(0.3);
  });

  test("stays exact across many additions", () => {
    const hundredTimesTenCents = Array.from({ length: 100 }, () => 10);
    expect(sumMinor(hundredTimesTenCents)).toBe(1000);
  });

  test("returns zero for an empty ledger", () => {
    expect(sumMinor([])).toBe(0);
  });
});

describe("formatMoney", () => {
  test("renders two decimals with the currency symbol", () => {
    expect(formatMoney(123456)).toBe("৳1,234.56");
  });

  test("uses a typographic minus so figures align in a tabular column", () => {
    expect(formatMoney(-50000)).toBe("−৳500.00");
    expect(formatMoney(-50000)).not.toContain("-");
  });

  test("adds a plus only for positive values when signed", () => {
    expect(formatMoney(500, "BDT", { signed: true })).toBe("+৳5.00");
    expect(formatMoney(-500, "BDT", { signed: true })).toBe("−৳5.00");
    expect(formatMoney(0, "BDT", { signed: true })).toBe("+৳0.00");
  });

  test("drops decimals in compact mode only for whole amounts", () => {
    expect(formatMoney(50000, "BDT", { compact: true })).toBe("৳500");
    expect(formatMoney(50050, "BDT", { compact: true })).toBe("৳500.50");
  });

  test("omits the symbol when asked", () => {
    expect(formatMoney(1000, "BDT", { symbol: false })).toBe("10.00");
  });

  test("falls back to the code for a currency with no known symbol", () => {
    expect(formatMoney(1000, "XYZ")).toBe("XYZ 10.00");
  });

  test("renders zero rather than NaN for a non-finite input", () => {
    expect(formatMoney(Number.NaN)).toBe("৳0.00");
  });
});

describe("readMinor", () => {
  test("prefers the migrated minor-unit column", () => {
    expect(readMinor(1234, 99)).toBe(1234);
  });

  test("falls back to the legacy float column before migration", () => {
    expect(readMinor(undefined, 12.34)).toBe(1234);
    expect(readMinor(null, 0.1)).toBe(10);
  });

  test("returns zero when neither column is present", () => {
    expect(readMinor(undefined, undefined)).toBe(0);
    expect(readMinor(null, null)).toBe(0);
  });

  test("treats a legacy zero as a real value, not as missing", () => {
    expect(readMinor(undefined, 0)).toBe(0);
  });
});

describe("currency metadata", () => {
  test("defaults unknown currencies to two minor digits", () => {
    expect(minorFactor("ZZZ")).toBe(100);
  });

  test("is case-insensitive", () => {
    expect(currencySymbol("bdt")).toBe("৳");
    expect(currencySymbol("usd")).toBe("$");
  });
});
