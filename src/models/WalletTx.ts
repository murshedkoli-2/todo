import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type TxType = "credit" | "debit";

export interface IWalletTx extends Document {
  userId: Types.ObjectId;
  walletId: Types.ObjectId;
  type: TxType;           // credit = money in, debit = money out
  amount: number;
  note?: string;
  date: Date;
  balanceAfter: number;   // snapshot of wallet balance after this tx
  createdAt: Date;
  updatedAt: Date;
}

const WalletTxSchema = new Schema<IWalletTx>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be > 0"],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, "Note cannot exceed 500 characters"],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const WalletTx: Model<IWalletTx> =
  mongoose.models.WalletTx || mongoose.model<IWalletTx>("WalletTx", WalletTxSchema);

export default WalletTx;
