/**
 * Client-facing types and display tables.
 *
 * Domain types are re-exported from the zod schemas rather than declared twice:
 * the schema is the single source of truth, so a new status value cannot be
 * added to validation and forgotten here.
 */

export type {
  TodoStatus, PaymentStatus, TodoPriority, PaymentMethod, TaskService,
} from "@/lib/schemas/todo";
export { TASK_SERVICES } from "@/lib/schemas/todo";
export {
  MAX_FIELD_LENGTH, SERVICE_FIELDS, fieldDef, hasSecretField,
} from "@/lib/serviceCatalogue";
export type { ServiceFieldDef, ServiceFieldType } from "@/lib/serviceCatalogue";
export {
  SECRET_MASK, describeSubtaskFields, isSubtaskDone, isSubtaskStarted,
  missingFieldCount, normalizeSubtasks, resolveSubtaskStatus, subtaskProgress,
} from "@/lib/subtasks";
export type {
  DescribedField, SubtaskProgress, SubtaskStatus, TaskSubtask,
} from "@/lib/subtasks";

export type { TaskInstallmentDTO as TaskInstallment, TodoDTO as Todo } from "@/lib/dto/todo";

import { isPastDue } from "@/lib/dueDate";
import type { TodoDTO } from "@/lib/dto/todo";
import { TASK_SERVICES as SERVICE_CATALOGUE, SUBTASK_STATUSES } from "@/lib/schemas/todo";
import type {
  PaymentMethod, PaymentStatus, SubtaskStatus, TaskService, TodoPriority, TodoStatus,
} from "@/lib/schemas/todo";

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
  if (todo.status === "canceled") return "canceled";
  if (todo.status === "completed") return "completed";
  if (todo.dueDate && isPastDue(todo.dueDate)) return "overdue";
  return todo.status;
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  completed: "Completed",
  canceled: "Canceled",
  overdue: "Overdue",
};

/** The four real, settable statuses — `overdue` is excluded by construction. */
export const BOARD_COLUMNS: TodoStatus[] = ["todo", "in_progress", "completed", "canceled"];

/**
 * What a sub-task can be set to, least to most finished — the order the
 * segmented control renders, so left-to-right is progress.
 */
export const SUBTASK_STATUS_CHOICES: readonly SubtaskStatus[] = SUBTASK_STATUSES;

/**
 * Compact status wording for a checklist row, where {@link STATUS_LABELS} is
 * two words wide and sits three abreast next to a service name.
 */
export const SUBTASK_STATUS_SHORT_LABELS: Record<SubtaskStatus, string> = {
  todo: "To do",
  in_progress: "Doing",
  completed: "Done",
};

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

/* ── Services ─────────────────────────────────────────────────────────────
   The standing catalogue of jobs the desk handles. A task carries a set of
   these, so every table below is keyed by the same enum the schema validates
   against — adding a service is one entry in `TASK_SERVICES` plus one row in
   each table here, and TypeScript flags the rows that were missed. */

export const SERVICE_LABELS: Record<TaskService, string> = {
  birth_certificate: "Birth Certificate",
  birth_certificate_correction: "Birth Certificate Correction",
  new_nid: "New NID",
  nid_correction: "NID Correction",
  new_passport: "New Passport",
  passport_correction: "Passport Correction",
  police_clearance: "Police Clearance",
  bmet_registration: "BMET Registration",
  training_admission: "Training Admission",
};

/**
 * Compact form for card chips, where three of these sit side by side and the
 * full names wrap into a paragraph.
 */
export const SERVICE_SHORT_LABELS: Record<TaskService, string> = {
  birth_certificate: "Birth Cert.",
  birth_certificate_correction: "Birth Fix",
  new_nid: "New NID",
  nid_correction: "NID Fix",
  new_passport: "Passport",
  passport_correction: "Passport Fix",
  police_clearance: "Police Clr.",
  bmet_registration: "BMET",
  training_admission: "Training",
};

/** One line of what the job actually is, shown under the label in the picker. */
export const SERVICE_DESCRIPTIONS: Record<TaskService, string> = {
  birth_certificate: "Registering a birth or getting a certified copy.",
  birth_certificate_correction: "Amending a name, date, or parentage on a registered birth.",
  new_nid: "First-time national ID registration.",
  nid_correction: "Fixing a name, date, or address on an existing NID.",
  new_passport: "A first passport or a renewal.",
  passport_correction: "Amending details on an issued passport.",
  police_clearance: "Police verification certificate.",
  bmet_registration: "Manpower registration for overseas employment.",
  training_admission: "Enrolling on a training course.",
};

/**
 * Colour by document family rather than one per service. Nine services and six
 * palette families means sharing, and the sharing is the point: each pair that
 * shares a colour is one errand's "new" and "correction" halves, and the last
 * pair is the two legs of going abroad for work. Reading those as one group is
 * how the work is actually sorted at the counter.
 */
export const SERVICE_COLORS: Record<TaskService, string> = {
  birth_certificate: "var(--green)",
  birth_certificate_correction: "var(--green)",
  new_nid: "var(--accent)",
  nid_correction: "var(--accent)",
  new_passport: "var(--purple)",
  passport_correction: "var(--purple)",
  police_clearance: "var(--orange)",
  bmet_registration: "var(--yellow)",
  training_admission: "var(--yellow)",
};

/** Service text on its own pale tint. See {@link STATUS_TEXT_COLORS}. */
export const SERVICE_TEXT_COLORS: Record<TaskService, string> = {
  birth_certificate: "var(--green-ink)",
  birth_certificate_correction: "var(--green-ink)",
  new_nid: "var(--accent-ink)",
  nid_correction: "var(--accent-ink)",
  new_passport: "var(--purple-ink)",
  passport_correction: "var(--purple-ink)",
  police_clearance: "var(--orange-ink)",
  bmet_registration: "var(--yellow-ink)",
  training_admission: "var(--yellow-ink)",
};

/**
 * The colour to print *on* a solid {@link SERVICE_COLORS} fill — the picker's
 * checkmark sits on one. White clears AA on the accent and the purple and fails
 * on the green, the orange, and the yellow, so the partner token is looked up
 * rather than assumed. See {@link ACCOUNT_TYPE_ON_COLORS}.
 */
export const SERVICE_ON_COLORS: Record<TaskService, string> = {
  birth_certificate: "var(--on-green)",
  birth_certificate_correction: "var(--on-green)",
  new_nid: "var(--on-accent)",
  nid_correction: "var(--on-accent)",
  new_passport: "var(--on-purple)",
  passport_correction: "var(--on-purple)",
  police_clearance: "var(--on-orange)",
  bmet_registration: "var(--on-yellow)",
  training_admission: "var(--on-yellow)",
};

/** Every service, in catalogue order — the order the picker renders them. */
export const SERVICE_CHOICES: readonly TaskService[] = SERVICE_CATALOGUE;

/** Joins a task's services into one line, for dense rows and summaries. */
export function formatServices(services: readonly TaskService[]): string {
  return services.map((service) => SERVICE_LABELS[service]).join(", ");
}

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
  canceled: "var(--text-muted)",
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
  canceled: "var(--text-secondary)",
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
