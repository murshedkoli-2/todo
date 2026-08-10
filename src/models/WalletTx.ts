import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { TX_TYPES } from "@/lib/schemas/wallet";
import type { TxType } from "@/lib/schemas/wallet";

export type { TxType };

export interface IWalletTx extends Document {
  userId: Types.ObjectId;
  walletId: Types.ObjectId;
  /** credit = money in, debit = money out. */
  type: TxType;
  /** Integer minor units. Always positive; `type` carries direction. */
  amountMinor: number;
  /** @deprecated Pre-migration float column. Read via `readMinor`, never written. */
  amount?: number;
  note?: string;
  date: Date;
  /**
   * @deprecated Stored running balance.
   *
   * Deleting or back-dating a transaction left every later row's snapshot
   * describing a balance that never existed. The running balance is now
   * computed at read time from the ordered ledger instead.
   */
  balanceAfter?: number;
  createdAt: Date;
  updatedAt: Date;
}

const WalletTxSchema = new Schema<IWalletTx>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true },
    type: { type: String, enum: TX_TYPES, required: true },
    amountMinor: {
      type: Number,
      required: true,
      min: [1, "Amount must be greater than 0"],
      validate: {
        validator: Number.isInteger,
        message: "Amount must be an integer number of minor units",
      },
    },
    amount: { type: Number, default: undefined },
    note: { type: String, trim: true, maxlength: [500, "Note cannot exceed 500 characters"] },
    date: { type: Date, default: Date.now },
    balanceAfter: { type: Number, default: undefined },
  },
  { timestamps: true }
);

/* Statement reads: one wallet, newest first. Aggregation: count/sum per user. */
WalletTxSchema.index({ walletId: 1, date: -1, createdAt: -1 });
WalletTxSchema.index({ userId: 1, walletId: 1 });

const WalletTx: Model<IWalletTx> =
  mongoose.models.WalletTx || mongoose.model<IWalletTx>("WalletTx", WalletTxSchema);

export default WalletTx;
