import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { ENTRY_TYPES } from "@/lib/schemas/ledger";
import type { EntryType } from "@/lib/schemas/ledger";

export type { EntryType };

export interface ILedgerEntry extends Document {
  userId: Types.ObjectId;
  personId: Types.ObjectId;
  type: EntryType;
  /** Integer minor units (paisa). Always positive; `type` carries direction. */
  amountMinor: number;
  /** @deprecated Pre-migration float column. Read via `readMinor`, never written. */
  amount?: number;
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
    },
    personId: {
      type: Schema.Types.ObjectId,
      ref: "Ledger",
      required: [true, "Person ID is required"],
    },
    type: {
      type: String,
      enum: { values: ENTRY_TYPES, message: "Type must be receivable or payable" },
      required: [true, "Type is required"],
    },
    amountMinor: {
      type: Number,
      required: [true, "Amount is required"],
      min: [1, "Amount must be greater than 0"],
      validate: {
        validator: Number.isInteger,
        message: "Amount must be an integer number of minor units",
      },
    },
    amount: { type: Number, default: undefined },
    note: {
      type: String,
      trim: true,
      maxlength: [500, "Note cannot exceed 500 characters"],
    },
    date: { type: Date, required: [true, "Date is required"], default: Date.now },
  },
  { timestamps: true }
);

/* The statement view reads one person's entries in date order; the balance
   aggregation groups a user's entries by person. */
LedgerEntrySchema.index({ personId: 1, date: 1, createdAt: 1 });
LedgerEntrySchema.index({ userId: 1, personId: 1 });

const LedgerEntry: Model<ILedgerEntry> =
  mongoose.models.LedgerEntry ||
  mongoose.model<ILedgerEntry>("LedgerEntry", LedgerEntrySchema);

export default LedgerEntry;
