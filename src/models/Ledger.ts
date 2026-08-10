import mongoose, { Schema, Document, Model, Types } from "mongoose";

/** A counterparty — the person or shop a set of ledger entries belongs to. */
export interface ILedger extends Document {
  userId: Types.ObjectId;
  name: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerSchema = new Schema<ILedger>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, "Note cannot exceed 500 characters"],
    },
  },
  { timestamps: true }
);

LedgerSchema.index({ userId: 1, createdAt: -1 });

const Ledger: Model<ILedger> =
  mongoose.models.Ledger || mongoose.model<ILedger>("Ledger", LedgerSchema);

export default Ledger;
