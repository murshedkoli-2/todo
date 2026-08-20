/**
 * Natural-language parsing for the quick-add bar.
 *
 * Typing "Send the invoice friday !high" should create a task due Friday at
 * high priority, without the user opening a form, picking a date out of a
 * calendar widget and choosing a level from a select. That round trip — a full
 * page navigation and five controls — was the most-travelled path in the app
 * and by far the slowest.
 *
 * Rules the implementation follows:
 *
 *   - A token is only consumed when it stands alone as a word. A task called
 *     "Monday retrospective" keeps its title; "retro monday" gets a date.
 *   - Only the first date and the first priority are consumed. A second
 *     mention is almost always part of the title.
 *   - Everything not consumed is the title, with the gaps closed up.
 *   - Parsing is pure and takes `now` as an argument, so behaviour on the last
 *     day of a month is testable rather than a matter of luck.
 */

import { dayKeyToDate, localDayKey } from "@/lib/dueDate";
import type { TodoPriority } from "@/lib/schemas/todo";

export interface QuickAddToken {
  kind: "date" | "priority";
  /** The literal text that was consumed, for echoing back to the user. */
  text: string;
  /** What it resolved to, for the preview chip. */
  label: string;
}

export interface QuickAddResult {
  title: string;
  /** Midnight UTC on the due day, matching what a date input submits. */
  dueDate: Date | null;
  priority: TodoPriority;
  tokens: QuickAddToken[];
}

/** A consumed span of the input, plus what it meant. */
interface Match {
  start: number;
  end: number;
  token: QuickAddToken;
}

const MS_PER_DAY = 86_400_000;

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

/**
 * `!urgent` and the Todoist-style `!1`. Numbers count down from urgent because
 * that is the convention users arrive with — p1 is the fire, not the backlog.
 */
const PRIORITY_WORDS: Record<string, TodoPriority> = {
  urgent: "urgent", u: "urgent", "1": "urgent", p1: "urgent",
  high: "high", h: "high", "2": "high", p2: "high",
  medium: "medium", med: "medium", m: "medium", "3": "medium", p3: "medium",
  low: "low", l: "low", "4": "low", p4: "low",
};

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  none: "No priority", low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};

/** Syntax shown in the quick-add hint, so help and behaviour cannot drift. */
export const QUICK_ADD_HINTS: ReadonlyArray<{ syntax: string; means: string }> = [
  { syntax: "tomorrow", means: "Due date" },
  { syntax: "friday", means: "Next Friday" },
  { syntax: "in 3 days", means: "Relative date" },
  { syntax: "25 dec", means: "Calendar date" },
  { syntax: "!high", means: "Priority" },
  { syntax: "!1", means: "Urgent" },
];

/** Adds whole days to a day key without tripping over month boundaries. */
function shiftDayKey(dayKey: string, days: number): string {
  return new Date(dayKeyToDate(dayKey).getTime() + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** Soonest future date with the given weekday. Today resolves to next week. */
function nextWeekday(todayKey: string, weekday: number): string {
  const current = dayKeyToDate(todayKey).getUTCDay();
  // 1–7 rather than 0–6: a bare "monday" typed on a Monday means the next one,
  // otherwise the token silently resolves to a day already half spent.
  const delta = ((weekday - current + 6) % 7) + 1;
  return shiftDayKey(todayKey, delta);
}

/** Next occurrence of a day/month pair, rolling into next year once it is past. */
function calendarDay(todayKey: string, month: number, day: number): string | null {
  const build = (year: number): string | null => {
    const date = new Date(Date.UTC(year, month, day));
    // Rejects 31 February, which `Date.UTC` would silently roll into March.
    return date.getUTCMonth() === month && date.getUTCDate() === day
      ? date.toISOString().slice(0, 10)
      : null;
  };

  const thisYear = build(Number(todayKey.slice(0, 4)));
  if (!thisYear) return null;
  return thisYear >= todayKey ? thisYear : build(Number(todayKey.slice(0, 4)) + 1);
}

const MONTH_NAMES = Object.keys(MONTHS).join("|");
const WEEKDAY_NAMES = Object.keys(WEEKDAYS).join("|");

/** Every date phrase the parser understands, most specific pattern first. */
const DATE_PATTERNS: ReadonlyArray<{
  regex: RegExp;
  resolve: (groups: RegExpExecArray, todayKey: string) => string | null;
}> = [
  // 2026-12-25 — an explicit year, so it is used as given rather than rolled.
  {
    regex: /\b(\d{4})-(\d{2})-(\d{2})\b/,
    resolve: ([, year, month, day]) =>
      calendarDay(`${year}-01-01`, Number(month) - 1, Number(day)),
  },
  // 25 dec
  {
    regex: new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAMES})\\b`, "i"),
    resolve: ([, day, month], todayKey) =>
      calendarDay(todayKey, MONTHS[month!.toLowerCase()]!, Number(day)),
  },
  // dec 25
  {
    regex: new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{1,2})\\b`, "i"),
    resolve: ([, month, day], todayKey) =>
      calendarDay(todayKey, MONTHS[month!.toLowerCase()]!, Number(day)),
  },
  // in 3 days / in 2 weeks
  {
    regex: /\bin\s+(\d{1,3})\s+(days?|weeks?)\b/i,
    resolve: ([, amount, unit], todayKey) =>
      shiftDayKey(todayKey, Number(amount) * (unit!.toLowerCase().startsWith("week") ? 7 : 1)),
  },
  { regex: /\bday\s+after\s+tomorrow\b/i, resolve: (_, todayKey) => shiftDayKey(todayKey, 2) },
  { regex: /\bnext\s+week\b/i, resolve: (_, todayKey) => shiftDayKey(todayKey, 7) },
  { regex: /\b(?:today|tonight)\b/i, resolve: (_, todayKey) => todayKey },
  { regex: /\btomorrow\b/i, resolve: (_, todayKey) => shiftDayKey(todayKey, 1) },
  // "next friday" is accepted as a synonym for "friday". The two readings
  // people have of it differ by a week, so the phrase is consumed rather than
  // left stranded in the title, and resolves to the unambiguous soonest match.
  {
    regex: new RegExp(`\\b(?:next\\s+)?(${WEEKDAY_NAMES})\\b`, "i"),
    resolve: ([, name], todayKey) => nextWeekday(todayKey, WEEKDAYS[name!.toLowerCase()]!),
  },
];

function findDate(input: string, todayKey: string): { match: Match; dayKey: string } | null {
  for (const { regex, resolve } of DATE_PATTERNS) {
    const found = regex.exec(input);
    if (!found) continue;

    const dayKey = resolve(found, todayKey);
    if (!dayKey) continue;

    return {
      dayKey,
      match: {
        start: found.index,
        end: found.index + found[0].length,
        token: {
          kind: "date",
          text: found[0],
          label: dayKeyToDate(dayKey).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          }),
        },
      },
    };
  }
  return null;
}

const PRIORITY_REGEX = new RegExp(
  `(^|\\s)!(${Object.keys(PRIORITY_WORDS).join("|")})\\b`,
  "i"
);

function findPriority(input: string): { match: Match; priority: TodoPriority } | null {
  const found = PRIORITY_REGEX.exec(input);
  if (!found) return null;

  const priority = PRIORITY_WORDS[found[2]!.toLowerCase()]!;
  // The leading separator anchored the match but is not part of the token;
  // leaving it in place keeps the words either side from running together.
  const start = found.index + found[1]!.length;

  return {
    priority,
    match: {
      start,
      end: found.index + found[0].length,
      token: { kind: "priority", text: `!${found[2]}`, label: PRIORITY_LABEL[priority] },
    },
  };
}

/** Removes the consumed ranges and tidies the whitespace they leave behind. */
function stripRanges(input: string, ranges: ReadonlyArray<Match>): string {
  const ordered = [...ranges].sort((a, b) => b.start - a.start);
  const stripped = ordered.reduce(
    (text, { start, end }) => text.slice(0, start) + text.slice(end),
    input
  );
  return stripped.replace(/\s+/g, " ").trim();
}

/**
 * Parses a quick-add line. Never throws and never rejects input: anything it
 * does not recognise stays in the title, so the worst case is a plain task
 * reading exactly what the user typed.
 */
export function parseQuickAdd(input: string, now: Date = new Date()): QuickAddResult {
  const todayKey = localDayKey(now);

  const priorityHit = findPriority(input);
  const dateHit = findDate(input, todayKey);

  const matches: Match[] = [];
  if (dateHit) matches.push(dateHit.match);
  if (priorityHit) matches.push(priorityHit.match);

  return {
    title: stripRanges(input, matches),
    dueDate: dateHit ? dayKeyToDate(dateHit.dayKey) : null,
    priority: priorityHit?.priority ?? "none",
    tokens: [...matches].sort((a, b) => a.start - b.start).map((match) => match.token),
  };
}
