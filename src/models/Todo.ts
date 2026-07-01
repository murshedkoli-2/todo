import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type TodoStatus    = "todo" | "in_progress" | "completed";
export type PaymentStatus = "unpaid" | "partial" | "paid";

export interface ITodo extends Document {
  userId: Types.ObjectId;
  title: string;
  description?: string;
  status: TodoStatus;
  dueDate?: Date;
  images: string[];
  featureImage?: string;
  paymentAmount?: number;
  paymentCurrency: string;
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
      index: true,
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
        values: ["todo", "in_progress", "completed"],
        message: "Status must be one of: todo, in_progress, completed",
      },
      default: "todo",
    },
    dueDate: {
      type: Date,
    },
    images: {
      type: [String],
      default: [],
    },
    featureImage: {
      type: String,
      default: undefined,
    },
    paymentAmount: {
      type: Number,
      min: [0, "Payment amount cannot be negative"],
      default: undefined,
    },
    paymentCurrency: {
      type: String,
      trim: true,
      maxlength: [10, "Currency code too long"],
      default: "BDT",
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ["unpaid", "partial", "paid"],
        message: "Payment status must be one of: unpaid, partial, paid",
      },
      default: "unpaid",
    },
  },
  {
    timestamps: true,
  }
);

const Todo: Model<ITodo> =
  mongoose.models.Todo || mongoose.model<ITodo>("Todo", TodoSchema);

export default Todo;
