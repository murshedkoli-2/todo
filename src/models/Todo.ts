import mongoose, { Schema, Document, Model, Types } from "mongoose";
import {
  PAYMENT_METHODS, PAYMENT_STATUSES, TODO_PRIORITIES, TODO_STATUSES,
} from "@/lib/schemas/todo";
import type {
  PaymentMethod, PaymentStatus, TodoPriority, TodoStatus,
} from "@/lib/schemas/todo";

export type { PaymentMethod, PaymentStatus, TodoPriority, TodoStatus };

export interface ITodo extends Document {
  userId: Types.ObjectId;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate?: Date;
  images: string[];
  featureImage?: string;
  /** The job's total cost, in integer minor units (paisa). See `src/lib/money.ts`. */
  paymentAmountMinor?: number;
  /** Received against that total, in integer minor units. */
  paidAmountMinor?: number;
  /** @deprecated Pre-migration float column. Read via `readMinor`, never written. */
  paymentAmount?: number;
  paymentCurrency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

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
        message: "Status must be one of: todo, in_progress, completed",
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
    paidAmountMinor: {
      type: Number,
      min: [0, "Paid amount cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Paid amount must be an integer number of minor units",
      },
      default: undefined,
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
TodoSchema.index({ userId: 1, createdAt: -1 });
TodoSchema.index({ userId: 1, status: 1, createdAt: -1 });
TodoSchema.index({ userId: 1, dueDate: 1 });
/* Serves the "urgent work first" sort, which is the default triage view. */
TodoSchema.index({ userId: 1, priority: -1, dueDate: 1 });

const Todo: Model<ITodo> =
  mongoose.models.Todo || mongoose.model<ITodo>("Todo", TodoSchema);

export default Todo;
