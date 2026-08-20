/**
 * Due dates are **calendar days**, not instants.
 *
 * `<input type="date">` submits `YYYY-MM-DD`, which `new Date(…)` reads as
 * UTC midnight. Comparing that instant against `Date.now()` — which is what
 * the app did — marks a task due *today* as overdue from 00:00 UTC onward, so
 * a card could read "Due today" while painted in the overdue red. The same
 * mistake made `daysUntil` disagree with the status badge beside it.
 *
 * Everything here works in day keys (`YYYY-MM-DD`) instead: the stored value
 * is read back in UTC, because that is the calendar day it was written as, and
 * "today" is read in the viewer's local zone, because that is the day they are
 * living in. Two day keys subtract cleanly and never disagree with each other.
 */

const MS_PER_DAY = 86_400_000;

/** The calendar day of a stored due date, as written by a date input. */
export function dueDayKey(dueDate: string | Date): string {
  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** The viewer's current calendar day, in their own timezone. */
export function localDayKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Midnight UTC for a day key — the instant a date input would have produced. */
export function dayKeyToDate(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`);
}

/**
 * Whole days from today until the due day. Negative when the day has passed,
 * `0` on the day itself — so "due today" is never counted as late.
 *
 * Returns `null` for an unparseable date rather than a misleading number.
 */
export function daysUntilDue(dueDate: string | Date, now: Date = new Date()): number | null {
  const due = dueDayKey(dueDate);
  if (!due) return null;
  const today = localDayKey(now);
  return Math.round(
    (dayKeyToDate(due).getTime() - dayKeyToDate(today).getTime()) / MS_PER_DAY
  );
}

/** A task is late only once its due *day* is behind us. */
export function isPastDue(dueDate: string | Date, now: Date = new Date()): boolean {
  const days = daysUntilDue(dueDate, now);
  return days !== null && days < 0;
}

/**
 * Short, human due label. Relative wording inside a week either way, because
 * "in 3 days" is actionable in a way "24 Aug" is not; an absolute date beyond
 * that, because "in 46 days" is not.
 */
export function formatDueLabel(
  dueDate: string | Date,
  { relative = true, now = new Date() }: { relative?: boolean; now?: Date } = {}
): string {
  const key = dueDayKey(dueDate);
  if (!key) return "";

  const absolute = dayKeyToDate(key).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  if (!relative) return absolute;

  const days = daysUntilDue(dueDate, now);
  if (days === null) return absolute;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0 && days >= -7) return `${Math.abs(days)} days late`;
  if (days > 0 && days <= 7) return `In ${days} days`;
  return absolute;
}
