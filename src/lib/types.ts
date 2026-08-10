/**
 * Client-facing types and display tables.
 *
 * Domain types are re-exported from the zod schemas rather than declared twice:
 * the schema is the single source of truth, so a new status value cannot be
 * added to validation and forgotten here.
 */

export type { TodoStatus, PaymentStatus } from "@/lib/schemas/todo";
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

import type { TodoDTO } from "@/lib/dto/todo";
import type { PaymentStatus, TodoStatus } from "@/lib/schemas/todo";
import type { AccountType } from "@/lib/schemas/wallet";

/** `overdue` is derived at render time, never stored. */
export type DisplayStatus = TodoStatus | "overdue";

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function getDisplayStatus(todo: TodoDTO): DisplayStatus {
  if (todo.status === "completed") return "completed";
  if (todo.dueDate && new Date(todo.dueDate) < new Date()) return "overdue";
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

export const MOBILE_BANKING_PROVIDERS = [
  "bKash", "Nagad", "Rocket", "Upay", "MyCash", "SureCash", "Other",
] as const;
