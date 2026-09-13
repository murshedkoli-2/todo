import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { MAX_FIELD_LENGTH, TASK_SERVICES as SERVICE_CATALOGUE } from "@/lib/serviceCatalogue";
import {
  PAYMENT_METHODS, PAYMENT_STATUSES, SUBTASK_STATUSES, TASK_SERVICES, TODO_PRIORITIES, TODO_STATUSES,
} from "@/lib/schemas/todo";
import type {
  PaymentMethod, PaymentStatus, SubtaskStatus, TaskService, TodoPriority, TodoStatus,
} from "@/lib/schemas/todo";

export type { PaymentMethod, PaymentStatus, SubtaskStatus, TaskService, TodoPriority, TodoStatus };

/**
 * A ticked service and its captured information.
 *
 * `fields` is a pair array rather than a keyed object — see the note on
 * `StoredField` in `lib/subtasks.ts` for why. Both halves are plain strings
 * here and are reconciled against the field catalogue on the way in and out,
 * so a key retired from the catalogue stops rendering without a migration.
 */
export interface ITodoSubtask {
  service: TaskService;
  /** Where this leg has got to — the three checklist values. */
  status: SubtaskStatus;
  /**
   * @deprecated The boolean `status` replaced.
   *
   * Kept on the schema, and only on the schema: rows written before the change
   * still carry it, and dropping it from the model would blank the field on the
   * hydrated read path — a task would silently reopen the first time an image
   * was added to it. Every write replaces the whole array without it, so a row
   * loses the key the next time it is saved. Read through
   * `resolveSubtaskStatus`, never directly.
   */
  done?: boolean;
  fields: Array<{ key: string; value: string }>;
}

export interface ITaskInstallment {
  _id?: Types.ObjectId | string;
  amountMinor: number;
  date: Date;
  paymentMethod: PaymentMethod;
  note?: string;
  createdAt: Date;
}

export interface ITodo extends Document {
  userId: Types.ObjectId;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate?: Date;
  /** Catalogue jobs this task covers. See `TASK_SERVICES`. */
  services: TaskService[];
  /**
   * One row per entry in `services`, holding what was captured for that job.
   * Kept in step with `services` by `normalizeSubtasks` — never written
   * independently of it.
   */
  subtasks: ITodoSubtask[];
  images: string[];
  featureImage?: string;
  /** The job's total cost, in integer minor units (paisa). See `src/lib/money.ts`. */
  paymentAmountMinor?: number;
  /** Initial payment / advance received, in integer minor units. */
  initialPaymentMinor?: number;
  /** Received against that total (initial + installments), in integer minor units. */
  paidAmountMinor?: number;
  /** Subsequent payment installments recorded against this task. */
  installments: ITaskInstallment[];
  /** @deprecated Pre-migration float column. Read via `readMinor`, never written. */
  paymentAmount?: number;
  paymentCurrency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentSchema = new Schema<ITaskInstallment>(
  {
    amountMinor: {
      type: Number,
      required: true,
      min: [1, "Installment amount must be greater than 0"],
      validate: {
        validator: Number.isInteger,
        message: "Installment amount must be an integer number of minor units",
      },
    },
    date: { type: Date, required: true, default: Date.now },
    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: "Payment method must be one of: unset, cash, bkash, nagad, rocket, bank, other",
      },
      default: "cash",
    },
    note: {
      type: String,
      trim: true,
      maxlength: [200, "Note cannot exceed 200 characters"],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/* `_id: false` because a sub-task is identified by its service, not by an id of
   its own — and the whole array is replaced on every write, so generated ids
   would churn on each save and mean nothing. */
const SubtaskFieldSchema = new Schema<{ key: string; value: string }>(
  {
    key: { type: String, required: true, trim: true, maxlength: 64 },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: [MAX_FIELD_LENGTH, `A value cannot exceed ${MAX_FIELD_LENGTH} characters`],
    },
  },
  { _id: false }
);

const SubtaskSchema = new Schema<ITodoSubtask>(
  {
    service: {
      type: String,
      required: true,
      enum: {
        values: SERVICE_CATALOGUE,
        message: "{VALUE} is not a service this desk offers",
      },
    },
    status: {
      type: String,
      enum: {
        values: SUBTASK_STATUSES,
        message: "Sub-task status must be one of: todo, in_progress, completed",
      },
      default: "todo",
    },
    // Legacy. See `ITodoSubtask.done` — read on the way out, never written.
    done: { type: Boolean, default: undefined },
    fields: { type: [SubtaskFieldSchema], default: [] },
  },
  { _id: false }
);

const TodoSchema = new Schema<ITodo>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: {
        values: TODO_STATUSES,
        message: "Status must be one of: todo, in_progress, completed, canceled",
      },
      default: "todo",
    },
    priority: {
      type: String,
      enum: {
        values: TODO_PRIORITIES,
        message: "Priority must be one of: none, low, medium, high, urgent",
      },
      default: "none",
    },
    dueDate: { type: Date },
    services: {
      type: [String],
      enum: {
        values: TASK_SERVICES,
        message: "{VALUE} is not a service this desk offers",
      },
      default: [],
    },
    subtasks: {
      type: [SubtaskSchema],
      default: [],
      /* One row per service at most, enforced by `normalizeSubtasks` before the
         write. The bound is here as well because this is the last gate before
         the document, and an unbounded array is how a document grows without
         limit. */
      validate: {
        validator: (value: ITodoSubtask[]) => value.length <= SERVICE_CATALOGUE.length,
        message: "A task cannot hold more sub-tasks than there are services",
      },
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (value: string[]) => value.length <= 20,
        message: "A task can hold at most 20 images",
      },
    },
    featureImage: { type: String, default: undefined },
    paymentAmountMinor: {
      type: Number,
      min: [0, "Payment amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Payment amount must be an integer number of minor units",
      },
      default: undefined,
    },
    initialPaymentMinor: {
      type: Number,
      min: [0, "Initial payment amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Initial payment amount must be an integer number of minor units",
      },
      default: undefined,
    },
    paidAmountMinor: {
      type: Number,
      min: [0, "Paid amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Paid amount must be an integer number of minor units",
      },
      default: undefined,
    },
    installments: {
      type: [InstallmentSchema],
      default: [],
    },
    paymentAmount: { type: Number, default: undefined, select: true },
    paymentCurrency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [10, "Currency code too long"],
      default: "BDT",
    },
    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: "Payment method must be one of: unset, cash, bkash, nagad, rocket, bank, other",
      },
      default: "unset",
    },
    paymentStatus: {
      type: String,
      enum: {
        values: PAYMENT_STATUSES,
        message: "Payment status must be one of: unpaid, partial, paid",
      },
      default: "unpaid",
    },
  },
  { timestamps: true }
);

/* Every list query is scoped to a user and ordered or filtered from there, so
   the single-field `userId` index these replace could not serve the sort. */
TodoSchema.index({ userId: 1, updatedAt: -1 });
TodoSchema.index({ userId: 1, createdAt: -1 });
TodoSchema.index({ userId: 1, status: 1, updatedAt: -1 });
TodoSchema.index({ userId: 1, status: 1, createdAt: -1 });
TodoSchema.index({ userId: 1, dueDate: 1 });
/* Serves the "urgent work first" sort, which is the default triage view. */
TodoSchema.index({ userId: 1, priority: -1, dueDate: 1 });
/* Multikey index behind the per-service filter — without it, asking for every
   open passport correction is a collection scan. */
TodoSchema.index({ userId: 1, services: 1, createdAt: -1 });

const Todo: Model<ITodo> =
  mongoose.models.Todo || mongoose.model<ITodo>("Todo", TodoSchema);

export default Todo;
