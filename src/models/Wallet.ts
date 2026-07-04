import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type AccountType = "cash" | "mobile_banking" | "bank_account";

export interface IWallet extends Document {
  userId: Types.ObjectId;
  name: string;           // e.g. "Cash", "bKash", "Dutch-Bangla Bank"
  accountType: AccountType;
  provider?: string;      // e.g. "bKash", "Nagad", "Rocket" for mobile banking; bank name for bank_account
  accountNumber?: string; // optional last 4 digits or masked
  balance: number;        // current balance (maintained by app)
  color?: string;         // optional user-chosen accent color hex
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Account name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    accountType: {
      type: String,
      enum: ["cash", "mobile_banking", "bank_account"],
      required: [true, "Account type is required"],
    },
    provider: {
      type: String,
      trim: true,
      maxlength: [60, "Provider name too long"],
    },
    accountNumber: {
      type: String,
      trim: true,
      maxlength: [30, "Account number too long"],
    },
    balance: {
      type: Number,
      default: 0,
    },
    color: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const Wallet: Model<IWallet> =
  mongoose.models.Wallet || mongoose.model<IWallet>("Wallet", WalletSchema);

export default Wallet;
