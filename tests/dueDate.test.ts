import { describe, expect, test } from "vitest";
import {
  dayKeyToDate, daysUntilDue, dueDayKey, formatDueLabel, isPastDue, localDayKey,
} from "@/lib/dueDate";

/** Local noon, so the local calendar day matches in either hemisphere's offset. */
const NOW = new Date(2026, 7, 19, 12, 0, 0); // Wednesday 19 Aug 2026

/** What a `<input type="date">` submits for a given day. */
const submitted = (dayKey: string) => `${dayKey}T00:00:00.000Z`;

describe("dueDayKey", () => {
  test("reads back the day a date input submitted", () => {
    expect(dueDayKey(submitted("2026-08-19"))).toBe("2026-08-19");
  });

  test("accepts a Date as well as a string", () => {
    expect(dueDayKey(new Date("2026-08-19T00:00:00.000Z"))).toBe("2026-08-19");
  });

  test("returns an empty key for an unparseable value", () => {
    expect(dueDayKey("not a date")).toBe("");
  });
});

describe("localDayKey", () => {
  test("formats the viewer's own calendar day", () => {
    expect(localDayKey(NOW)).toBe("2026-08-19");
  });

  test("zero-pads single-digit months and days", () => {
    expect(localDayKey(new Date(2026, 0, 5, 12, 0, 0))).toBe("2026-01-05");
  });
});

describe("daysUntilDue", () => {
  test("returns zero on the due day itself", () => {
    expect(daysUntilDue(submitted("2026-08-19"), NOW)).toBe(0);
  });

  test("counts forward to a future due day", () => {
    expect(daysUntilDue(submitted("2026-08-22"), NOW)).toBe(3);
  });

  test("counts backward for a passed due day", () => {
    expect(daysUntilDue(submitted("2026-08-17"), NOW)).toBe(-2);
  });

  test("returns null rather than a misleading number for a bad date", () => {
    expect(daysUntilDue("not a date", NOW)).toBeNull();
  });
});

describe("isPastDue", () => {
  /*
   * The regression this file exists for: the app compared the stored instant
   * (midnight UTC) against `Date.now()`, so a task due today read as overdue
   * from the first second of the day — the card said "Due today" in red.
   */
  test("a task due today is not past due, whatever the hour", () => {
    const endOfDay = new Date(2026, 7, 19, 23, 59, 59);

    expect(isPastDue(submitted("2026-08-19"), NOW)).toBe(false);
    expect(isPastDue(submitted("2026-08-19"), endOfDay)).toBe(false);
  });

  test("a task due yesterday is past due", () => {
    expect(isPastDue(submitted("2026-08-18"), NOW)).toBe(true);
  });

  test("a task due tomorrow is not past due", () => {
    expect(isPastDue(submitted("2026-08-20"), NOW)).toBe(false);
  });

  test("an unparseable date is never reported as past due", () => {
    expect(isPastDue("not a date", NOW)).toBe(false);
  });
});

describe("formatDueLabel", () => {
  test.each([
    ["2026-08-19", "Today"],
    ["2026-08-20", "Tomorrow"],
    ["2026-08-18", "Yesterday"],
    ["2026-08-22", "In 3 days"],
    ["2026-08-16", "3 days late"],
  ])("labels %s as %s", (dayKey, expected) => {
    expect(formatDueLabel(submitted(dayKey), { now: NOW })).toBe(expected);
  });

  test("falls back to an absolute date beyond a week out", () => {
    expect(formatDueLabel(submitted("2026-09-30"), { now: NOW })).toBe("30 Sept");
  });

  test("falls back to an absolute date beyond a week late", () => {
    expect(formatDueLabel(submitted("2026-07-01"), { now: NOW })).toBe("1 Jul");
  });

  test("renders the absolute form on request", () => {
    expect(formatDueLabel(submitted("2026-08-19"), { relative: false, now: NOW })).toBe("19 Aug");
  });

  test("returns an empty label for an unparseable date", () => {
    expect(formatDueLabel("not a date", { now: NOW })).toBe("");
  });
});

describe("dayKeyToDate", () => {
  test("round-trips a day key", () => {
    expect(dueDayKey(dayKeyToDate("2026-08-19"))).toBe("2026-08-19");
  });
});
