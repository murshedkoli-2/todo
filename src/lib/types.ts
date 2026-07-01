export type TodoStatus    = "todo" | "in_progress" | "completed";
export type DisplayStatus = TodoStatus | "overdue";
export type PaymentStatus = "unpaid" | "partial" | "paid";

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
