export type TodoStatus    = "todo" | "in_progress" | "completed";
export type DisplayStatus = TodoStatus | "overdue";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type EntryType     = "receivable" | "payable";
export type AccountType   = "cash" | "mobile_banking" | "bank_account";
export type TxType        = "credit" | "debit";

export interface Todo {
  _id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  ownerName: string;
  images: string[];
  featureImage?: string | null;
  paymentAmount?: number | null;
  paymentCurrency: string;
  paymentStatus: PaymentStatus;
}

export interface LedgerPerson {
  _id: string;
  name: string;
  note?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  _id: string;
  personId: string;
  userId: string;
  type: EntryType;
  amount: number;
  note?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerPersonWithBalance extends LedgerPerson {
  balance: number;          // positive = net receivable, negative = net payable
  totalReceivable: number;
  totalPayable: number;
  lastEntryDate: string | null;
  entryCount: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function getDisplayStatus(todo: Todo): DisplayStatus {
  if (todo.status === "completed") return "completed";
  if (todo.dueDate && new Date(todo.dueDate) < new Date()) return "overdue";
  return todo.status;
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  todo:        "To Do",
  in_progress: "In Progress",
  completed:   "Completed",
  overdue:     "Overdue",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid:  "Unpaid",
  partial: "Partial",
  paid:    "Paid",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid:  "#f85149",
  partial: "#e3b341",
  paid:    "#3fb950",
};

/* ─── Wallet ──────────────────────────────────────────────────────── */

export interface WalletAccount {
  _id: string;
  userId: string;
  name: string;
  accountType: AccountType;
  provider?: string;
  accountNumber?: string;
  balance: number;
  color?: string;
  createdAt: string;
  updatedAt: string;
  txCount: number;
}

export interface WalletTransaction {
  _id: string;
  walletId: string;
  userId: string;
  type: TxType;
  amount: number;
  note?: string;
  date: string;
  balanceAfter: number;
  createdAt: string;
  updatedAt: string;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash:           "Cash",
  mobile_banking: "Mobile Banking",
  bank_account:   "Bank Account",
};

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  cash:           "#e3b341",
  mobile_banking: "#bc8cff",
  bank_account:   "#4493f8",
};

export const MOBILE_BANKING_PROVIDERS = [
  "bKash", "Nagad", "Rocket", "Upay", "MyCash", "SureCash", "Other",
];
