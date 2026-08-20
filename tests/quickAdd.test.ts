import { describe, expect, test } from "vitest";
import { parseQuickAdd } from "@/lib/quickAdd";

/**
 * A fixed Wednesday, so weekday arithmetic is deterministic. Local noon rather
 * than midnight keeps the reference day the same in either hemisphere's offset.
 */
const WEDNESDAY = new Date(2026, 7, 19, 12, 0, 0); // 19 Aug 2026

const parse = (input: string) => parseQuickAdd(input, WEDNESDAY);
const dayOf = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

describe("parseQuickAdd — plain text", () => {
  test("returns the input unchanged when nothing is recognised", () => {
    const result = parse("Write the quarterly report");

    expect(result.title).toBe("Write the quarterly report");
    expect(result.dueDate).toBeNull();
    expect(result.priority).toBe("none");
    expect(result.tokens).toEqual([]);
  });

  test("trims and collapses stray whitespace", () => {
    expect(parse("   Call   the   bank  ").title).toBe("Call the bank");
  });

  test("returns an empty title for an empty input", () => {
    expect(parse("").title).toBe("");
  });
});

describe("parseQuickAdd — relative dates", () => {
  test("resolves today", () => {
    expect(dayOf(parse("Pay rent today").dueDate)).toBe("2026-08-19");
  });

  test("resolves tonight to the same day as today", () => {
    expect(dayOf(parse("Ship it tonight").dueDate)).toBe("2026-08-19");
  });

  test("resolves tomorrow", () => {
    expect(dayOf(parse("Pay rent tomorrow").dueDate)).toBe("2026-08-20");
  });

  test("resolves day after tomorrow", () => {
    expect(dayOf(parse("Renew day after tomorrow").dueDate)).toBe("2026-08-21");
  });

  test("resolves next week as seven days out", () => {
    expect(dayOf(parse("Review next week").dueDate)).toBe("2026-08-26");
  });

  test("resolves a relative day count", () => {
    expect(dayOf(parse("Follow up in 3 days").dueDate)).toBe("2026-08-22");
  });

  test("resolves a relative week count", () => {
    expect(dayOf(parse("Retro in 2 weeks").dueDate)).toBe("2026-09-02");
  });

  test("strips the date phrase from the title", () => {
    expect(parse("Follow up in 3 days").title).toBe("Follow up");
  });
});

describe("parseQuickAdd — weekdays", () => {
  test("resolves the next occurrence of a weekday", () => {
    // Wednesday the 19th → Friday the 21st.
    expect(dayOf(parse("Send invoice friday").dueDate)).toBe("2026-08-21");
  });

  test("resolves a weekday earlier in the week to the following one", () => {
    // Monday has already passed this week, so it lands on the 24th.
    expect(dayOf(parse("Standup monday").dueDate)).toBe("2026-08-24");
  });

  test("resolves today's own weekday to next week, never to today", () => {
    expect(dayOf(parse("Sync wednesday").dueDate)).toBe("2026-08-26");
  });

  test("accepts abbreviations", () => {
    expect(dayOf(parse("Ship fri").dueDate)).toBe("2026-08-21");
  });

  test("treats 'next friday' as the soonest Friday", () => {
    const result = parse("Ship next friday");
    expect(dayOf(result.dueDate)).toBe("2026-08-21");
    expect(result.title).toBe("Ship");
  });
});

describe("parseQuickAdd — calendar dates", () => {
  test("resolves day-then-month", () => {
    expect(dayOf(parse("Renew licence 25 dec").dueDate)).toBe("2026-12-25");
  });

  test("resolves month-then-day", () => {
    expect(dayOf(parse("Renew licence dec 25").dueDate)).toBe("2026-12-25");
  });

  test("rolls a past calendar date into next year", () => {
    // 5 Jan is behind the reference date, so it means next January.
    expect(dayOf(parse("Taxes 5 jan").dueDate)).toBe("2027-01-05");
  });

  test("resolves an explicit ISO date", () => {
    expect(dayOf(parse("Audit 2027-03-09").dueDate)).toBe("2027-03-09");
  });

  test("ignores an impossible calendar date", () => {
    const result = parse("Nonsense 31 feb");
    expect(result.dueDate).toBeNull();
    expect(result.title).toBe("Nonsense 31 feb");
  });
});

describe("parseQuickAdd — priority", () => {
  test.each([
    ["!urgent", "urgent"],
    ["!high", "high"],
    ["!medium", "medium"],
    ["!med", "medium"],
    ["!low", "low"],
  ] as const)("resolves the word form %s", (token, expected) => {
    expect(parse(`Fix the build ${token}`).priority).toBe(expected);
  });

  test.each([
    ["!1", "urgent"],
    ["!2", "high"],
    ["!3", "medium"],
    ["!4", "low"],
  ] as const)("resolves the numeric form %s", (token, expected) => {
    expect(parse(`Fix the build ${token}`).priority).toBe(expected);
  });

  test("is case-insensitive", () => {
    expect(parse("Fix the build !HIGH").priority).toBe("high");
  });

  test("strips the token from the title", () => {
    expect(parse("Fix the build !1").title).toBe("Fix the build");
  });

  test("strips a token from the middle without joining the words around it", () => {
    expect(parse("Fix !high the build").title).toBe("Fix the build");
  });

  test("ignores an unknown level and leaves it in the title", () => {
    const result = parse("Deploy !later");
    expect(result.priority).toBe("none");
    expect(result.title).toBe("Deploy !later");
  });

  test("ignores a bare exclamation mark", () => {
    const result = parse("Ship it!");
    expect(result.priority).toBe("none");
    expect(result.title).toBe("Ship it!");
  });
});

describe("parseQuickAdd — combinations", () => {
  test("parses a date and a priority together", () => {
    const result = parse("Send the invoice friday !high");

    expect(result.title).toBe("Send the invoice");
    expect(dayOf(result.dueDate)).toBe("2026-08-21");
    expect(result.priority).toBe("high");
  });

  test("reports the recognised tokens in the order they appeared", () => {
    const result = parse("Ship !1 tomorrow");

    expect(result.tokens.map((token) => token.kind)).toEqual(["priority", "date"]);
    expect(result.tokens.map((token) => token.label)).toEqual(["Urgent", "20 Aug"]);
  });

  test("consumes only the first date mentioned", () => {
    const result = parse("Move tomorrow meeting to friday");

    expect(dayOf(result.dueDate)).toBe("2026-08-20");
    expect(result.title).toBe("Move meeting to friday");
  });

  test("leaves a date word that is part of a longer word alone", () => {
    const result = parse("Mondays are for planning");

    expect(result.dueDate).toBeNull();
    expect(result.title).toBe("Mondays are for planning");
  });

  test("keeps a title that is nothing but a date phrase from becoming empty-ish", () => {
    // The caller decides what to do with an empty title; the parser only
    // reports honestly that everything it saw was a date.
    const result = parse("tomorrow");

    expect(result.title).toBe("");
    expect(dayOf(result.dueDate)).toBe("2026-08-20");
  });
});

describe("parseQuickAdd — boundary dates", () => {
  test("crosses a month boundary correctly", () => {
    const lastOfMonth = new Date(2026, 7, 31, 12, 0, 0); // 31 Aug 2026
    const result = parseQuickAdd("Invoice tomorrow", lastOfMonth);

    expect(dayOf(result.dueDate)).toBe("2026-09-01");
  });

  test("crosses a year boundary correctly", () => {
    const newYearsEve = new Date(2026, 11, 31, 12, 0, 0);
    const result = parseQuickAdd("Invoice in 2 days", newYearsEve);

    expect(dayOf(result.dueDate)).toBe("2027-01-02");
  });

  test("handles a leap day", () => {
    const beforeLeapDay = new Date(2028, 1, 27, 12, 0, 0); // 27 Feb 2028
    const result = parseQuickAdd("Audit in 2 days", beforeLeapDay);

    expect(dayOf(result.dueDate)).toBe("2028-02-29");
  });
});
