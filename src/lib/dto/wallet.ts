import type { Types } from "mongoose";
import { readMinor } from "@/lib/money";
import type { AccountType, TxType } from "@/lib/schemas/wallet";

export interface WalletAccountDTO {
  _id: string;
  userId: string;
  name: string;
  accountType: AccountType;
  provider?: string;
  accountNumber?: string;
  /** Integer minor units. */
  balanceMinor: number;
  color?: string;
  createdAt: string;
  updatedAt: string;
  txCount: number;
}

export interface WalletTxDTO {
  _id: string;
  walletId: string;
  userId: string;
  type: TxType;
  amountMinor: number;
  note?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTxWithBalanceDTO extends WalletTxDTO {
  /** Balance after this transaction, recomputed from the ordered ledger. */
  runningBalanceMinor: number;
}

interface WalletSource {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  name: string;
  accountType: string;
  provider?: string | null;
  accountNumber?: string | null;
  balanceMinor?: number | null;
  balance?: number | null;
  color?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TxSource {
  _id: Types.ObjectId | string;
  walletId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  type: string;
  amountMinor?: number | null;
  amount?: number | null;
  note?: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export function toWalletDTO(source: WalletSource, txCount = 0): WalletAccountDTO {
  return {
    _id: source._id.toString(),
    userId: source.userId.toString(),
    name: source.name,
    accountType: source.accountType as AccountType,
    provider: source.provider ?? undefined,
    accountNumber: source.accountNumber ?? undefined,
    balanceMinor: readMinor(source.balanceMinor, source.balance),
    color: source.color ?? undefined,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    txCount,
  };
}

export function toTxDTO(source: TxSource): WalletTxDTO {
  return {
    _id: source._id.toString(),
    walletId: source.walletId.toString(),
    userId: source.userId.toString(),
    type: source.type as TxType,
    amountMinor: readMinor(source.amountMinor, source.amount),
    note: source.note ?? undefined,
    date: source.date.toISOString(),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

/** See `toEntriesWithRunningBalance` — same reasoning, credit/debit instead. */
export function toTxsWithRunningBalance(
  chronologicalTxs: readonly TxSource[]
): WalletTxWithBalanceDTO[] {
  let runningBalanceMinor = 0;

  return chronologicalTxs.map((source) => {
    const tx = toTxDTO(source);
    runningBalanceMinor += tx.type === "credit" ? tx.amountMinor : -tx.amountMinor;
    return { ...tx, runningBalanceMinor };
  });
}
