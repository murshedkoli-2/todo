import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type EntryType = "receivable" | "payable";

export interface ILedgerEntry extends Document {
  userId: Types.ObjectId;
  personId: Types.ObjectId;
  type: EntryType;
  amount: number;
  note?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    personId: {
      type: Schema.Types.ObjectId,
      ref: "Ledger",
      required: [true, "Person ID is required"],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ["receivable", "payable"],
        message: "Type must be receivable or payable",
      },
      required: [true, "Type is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, "Note cannot exceed 500 characters"],
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
    },
  },
  { timestamps: true }
);

const LedgerEntry: Model<ILedgerEntry> =
  mongoose.models.LedgerEntry ||
  mongoose.model<ILedgerEntry>("LedgerEntry", LedgerEntrySchema);

export default LedgerEntry;
