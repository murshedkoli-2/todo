/**
 * Client-facing types and display tables.
 *
 * Domain types are re-exported from the zod schemas rather than declared twice:
 * the schema is the single source of truth, so a new status value cannot be
 * added to validation and forgotten here.
 */

export type {
  TodoStatus, PaymentStatus, TodoPriority, PaymentMethod,
} from "@/lib/schemas/todo";
export type { EntryType } from "@/lib/schemas/ledger";
export type { AccountType, TxType } from "@/lib/schemas/wallet";

export type { TodoDTO as Todo } from "@/lib/dto/todo";
export type {
  LedgerPersonDTO as LedgerPerson,
  LedgerEntryDTO as LedgerEntry,
  LedgerEntryWithBalanceDTO as LedgerEntryWithBalance,
  LedgerPersonWithBalanceDTO as LedgerPersonWithBalance,
} from "@/lib/dto/ledger";
export type {
  WalletAccountDTO as WalletAccount,
  WalletTxDTO as WalletTransaction,
  WalletTxWithBalanceDTO as WalletTransactionWithBalance,
} from "@/lib/dto/wallet";

import { isPastDue } from "@/lib/dueDate";
import type { TodoDTO } from "@/lib/dto/todo";
import type {
  PaymentMethod, PaymentStatus, TodoPriority, TodoStatus,
} from "@/lib/schemas/todo";
import type { AccountType } from "@/lib/schemas/wallet";

/** `overdue` is derived at render time, never stored. */
export type DisplayStatus = TodoStatus | "overdue";

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * A task is overdue once its due *day* has passed — not the instant its stored
 * midnight-UTC value went by, which marked anything due today as late from the
 * first second of the day. See `lib/dueDate.ts`.
 */
export function getDisplayStatus(todo: TodoDTO): DisplayStatus {
  if (todo.status === "completed") return "completed";
  if (todo.dueDate && isPastDue(todo.dueDate)) return "overdue";
  return todo.status;
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
  overdue: "Overdue",
};

/** The three real, settable statuses — `overdue` is excluded by construction. */
export const BOARD_COLUMNS: TodoStatus[] = ["todo", "in_progress", "completed"];

/* ── Priority ─────────────────────────────────────────────────────────────
   `none` is deliberately unlabelled in most surfaces: an untriaged task should
   look untriaged, not carry a badge competing with the three real levels. */

export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/** Compact form for chips and dense rows, where the word "priority" is noise. */
export const PRIORITY_SHORT_LABELS: Record<TodoPriority, string> = {
  none: "—",
  low: "Low",
  medium: "Med",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_COLORS: Record<TodoPriority, string> = {
  none: "var(--text-muted)",
  low: "var(--text-secondary)",
  medium: "var(--accent)",
  high: "var(--orange)",
  urgent: "var(--red)",
};

/** Priority text on a tinted surface. See {@link STATUS_TEXT_COLORS}. */
export const PRIORITY_TEXT_COLORS: Record<TodoPriority, string> = {
  none: "var(--text-muted)",
  low: "var(--text-secondary)",
  medium: "var(--accent-ink)",
  high: "var(--orange-ink)",
  urgent: "var(--red-ink)",
};

/**
 * Sort weight. Higher is more urgent, so `b - a` puts urgent work first and
 * untriaged tasks last — which is the order a triage view wants.
 */
export const PRIORITY_RANK: Record<TodoPriority, number> = {
  none: 0, low: 1, medium: 2, high: 3, urgent: 4,
};

/** The levels a user can pick, most urgent first — menus read top-down. */
export const PRIORITY_CHOICES: TodoPriority[] = ["urgent", "high", "medium", "low", "none"];

/* ── Payment method ───────────────────────────────────────────────────────
   `unset` is the default and renders as nothing, the same way `none` does for
   priority: most tasks are written down before any money has changed hands. */

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  unset: "Not recorded",
  cash: "Cash",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  bank: "Bank transfer",
  other: "Other",
};

/** Offered in the form, commonest first. `unset` is the clear-it choice. */
export const PAYMENT_METHOD_CHOICES: PaymentMethod[] = [
  "cash", "bkash", "nagad", "rocket", "bank", "other", "unset",
];

export const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  unset: "var(--text-muted)",
  cash: "var(--yellow)",
  bkash: "var(--purple)",
  nagad: "var(--orange)",
  rocket: "var(--purple)",
  bank: "var(--accent)",
  other: "var(--text-secondary)",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
};

/**
 * Display colours reference design tokens rather than raw hex so both themes
 * stay in sync. Safe anywhere a CSS colour is expected (including `color-mix`).
 */

/** Status fills — dots, bars, borders. Vivid. */
export const STATUS_COLORS: Record<DisplayStatus, string> = {
  todo: "var(--accent)",
  in_progress: "var(--yellow)",
  completed: "var(--green)",
  overdue: "var(--red)",
};

/**
 * Status text sitting on a tinted surface. The vivid fills above only reach
 * ~1.6:1 on their own light-mode tints, so labels must use these instead.
 */
export const STATUS_TEXT_COLORS: Record<DisplayStatus, string> = {
  todo: "var(--accent-ink)",
  in_progress: "var(--yellow-ink)",
  completed: "var(--green-ink)",
  overdue: "var(--red-ink)",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: "var(--red)",
  partial: "var(--yellow)",
  paid: "var(--green)",
};

/** Payment text on a tinted surface. See {@link STATUS_TEXT_COLORS}. */
export const PAYMENT_STATUS_TEXT_COLORS: Record<PaymentStatus, string> = {
  unpaid: "var(--red-ink)",
  partial: "var(--yellow-ink)",
  paid: "var(--green-ink)",
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  mobile_banking: "Mobile Banking",
  bank_account: "Bank Account",
};

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  cash: "var(--yellow)",
  mobile_banking: "var(--purple)",
  bank_account: "var(--accent)",
};

/**
 * The colour to print *on* a solid {@link ACCOUNT_TYPE_COLORS} fill.
 *
 * White clears AA on two of these three and fails badly on the yellow, so the
 * partner token is looked up rather than assumed — see the `--on-*` note in
 * `globals.css` and the guard in `tests/contrast.test.ts`.
 */
export const ACCOUNT_TYPE_ON_COLORS: Record<AccountType, string> = {
  cash: "var(--on-yellow)",
  mobile_banking: "var(--on-purple)",
  bank_account: "var(--on-accent)",
};

export const MOBILE_BANKING_PROVIDERS = [
  "bKash", "Nagad", "Rocket", "Upay", "MyCash", "SureCash", "Other",
] as const;
