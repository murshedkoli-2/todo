import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { ACCOUNT_TYPES } from "@/lib/schemas/wallet";
import type { AccountType } from "@/lib/schemas/wallet";

export type { AccountType };

export interface IWallet extends Document {
  userId: Types.ObjectId;
  name: string;
  accountType: AccountType;
  /** e.g. "bKash" for mobile banking, the bank's name for an account. */
  provider?: string;
  accountNumber?: string;
  /**
   * Cached balance in integer minor units.
   *
   * `WalletTx` is the source of truth; this is maintained by `$inc` inside the
   * same transaction as the transaction insert, so it is a fast read rather
   * than an independent value that can disagree. `walletService.recompute`
   * rebuilds it from the ledger if it ever needs reconciling.
   */
  balanceMinor: number;
  /** @deprecated Pre-migration float column. Read via `readMinor`, never written. */
  balance?: number;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    name: {
      type: String,
      required: [true, "Account name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    accountType: {
      type: String,
      enum: ACCOUNT_TYPES,
      required: [true, "Account type is required"],
    },
    provider: { type: String, trim: true, maxlength: [60, "Provider name too long"] },
    accountNumber: { type: String, trim: true, maxlength: [30, "Account number too long"] },
    balanceMinor: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Balance must be an integer number of minor units",
      },
    },
    balance: { type: Number, default: undefined },
    color: { type: String, trim: true },
  },
  { timestamps: true }
);

WalletSchema.index({ userId: 1, createdAt: 1 });

const Wallet: Model<IWallet> =
  mongoose.models.Wallet || mongoose.model<IWallet>("Wallet", WalletSchema);

export default Wallet;
