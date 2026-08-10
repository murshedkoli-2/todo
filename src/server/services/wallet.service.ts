import { Types } from "mongoose";
import Wallet from "@/models/Wallet";
import WalletTx from "@/models/WalletTx";
import {
  toTxDTO, toTxsWithRunningBalance, toWalletDTO,
  type WalletAccountDTO, type WalletTxDTO, type WalletTxWithBalanceDTO,
} from "@/lib/dto/wallet";
import { NotFoundError } from "@/lib/api/errors";
import { withTransaction } from "@/server/withTransaction";
import type { CreateAccountInput, CreateTxInput, UpdateAccountInput } from "@/lib/schemas/wallet";

/** Signed contribution of a transaction to its wallet's balance. */
function signedMinor(type: "credit" | "debit", amountMinor: number): number {
  return type === "credit" ? amountMinor : -amountMinor;
}

/**
 * Transaction counts for every wallet a user owns, in one query.
 *
 * Replaces a `countDocuments()` per wallet inside a `Promise.all` map.
 */
async function txCounts(userId: Types.ObjectId): Promise<Map<string, number>> {
  const rows = await WalletTx.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { userId } },
    { $group: { _id: "$walletId", count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

export async function listAccounts(userId: string): Promise<WalletAccountDTO[]> {
  const owner = new Types.ObjectId(userId);

  const [wallets, counts] = await Promise.all([
    Wallet.find({ userId: owner }).sort({ createdAt: 1 }).lean(),
    txCounts(owner),
  ]);

  return wallets.map((wallet) =>
    toWalletDTO(wallet, counts.get(wallet._id.toString()) ?? 0)
  );
}

export async function getAccountWithTransactions(
  userId: string,
  walletId: string
): Promise<{ wallet: WalletAccountDTO; transactions: WalletTxWithBalanceDTO[] }> {
  const owner = new Types.ObjectId(userId);

  const wallet = await Wallet.findOne({ _id: walletId, userId: owner }).lean();
  if (!wallet) throw new NotFoundError("Account not found");

  // Ascending so the running balance accumulates correctly; the client
  // reverses for display.
  const documents = await WalletTx.find({ walletId, userId: owner })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  return {
    wallet: toWalletDTO(wallet, documents.length),
    transactions: toTxsWithRunningBalance(documents),
  };
}

export async function createAccount(
  userId: string,
  input: CreateAccountInput
): Promise<WalletAccountDTO> {
  const owner = new Types.ObjectId(userId);

  return withTransaction(async (session) => {
    const [wallet] = await Wallet.create(
      [
        {
          userId: owner,
          name: input.name,
          accountType: input.accountType,
          provider: input.accountType === "cash" ? undefined : input.provider,
          accountNumber: input.accountNumber,
          balanceMinor: input.initialBalance,
          color: input.color,
        },
      ],
      { session, ordered: true }
    );

    // An opening balance is recorded as a real transaction so the statement
    // reconciles to the balance rather than starting from an unexplained figure.
    if (input.initialBalance > 0) {
      await WalletTx.create(
        [
          {
            userId: owner,
            walletId: wallet!._id,
            type: "credit",
            amountMinor: input.initialBalance,
            note: "Opening balance",
            date: new Date(),
          },
        ],
        { session, ordered: true }
      );
    }

    return toWalletDTO(wallet!, input.initialBalance > 0 ? 1 : 0);
  });
}

export async function updateAccount(
  userId: string,
  walletId: string,
  input: UpdateAccountInput
): Promise<WalletAccountDTO> {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};

  const assign = (field: string, value: string | null | undefined) => {
    if (value) set[field] = value;
    else unset[field] = "";
  };

  if (input.name !== undefined) set.name = input.name;
  if ("provider" in input) assign("provider", input.provider);
  if ("accountNumber" in input) assign("accountNumber", input.accountNumber);
  if ("color" in input) assign("color", input.color);

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;

  const owner = new Types.ObjectId(userId);
  const wallet = await Wallet.findOneAndUpdate({ _id: walletId, userId: owner }, update, {
    returnDocument: "after",
    runValidators: true,
  }).lean();

  if (!wallet) throw new NotFoundError("Account not found");

  const count = await WalletTx.countDocuments({ walletId, userId: owner });
  return toWalletDTO(wallet, count);
}

export async function deleteAccount(userId: string, walletId: string): Promise<void> {
  const owner = new Types.ObjectId(userId);

  await withTransaction(async (session) => {
    const wallet = await Wallet.findOneAndDelete({ _id: walletId, userId: owner }, { session });
    if (!wallet) throw new NotFoundError("Account not found");

    await WalletTx.deleteMany({ walletId, userId: owner }, { session });
  });
}

export interface TxResult {
  transaction: WalletTxDTO;
  balanceMinor: number;
  txCount: number;
}

/**
 * Records a transaction and moves the wallet balance atomically.
 *
 * The previous implementation read `wallet.balance`, added in Node, saved, then
 * inserted the transaction. Two concurrent requests both read the same starting
 * balance and one update was lost; a failure between the two writes left the
 * balance permanently disagreeing with its transactions. `$inc` inside a
 * transaction removes both failure modes.
 */
export async function createTransaction(
  userId: string,
  walletId: string,
  input: CreateTxInput
): Promise<TxResult> {
  const owner = new Types.ObjectId(userId);
  const delta = signedMinor(input.type, input.amount);

  return withTransaction(async (session) => {
    const wallet = await Wallet.findOneAndUpdate(
      { _id: walletId, userId: owner },
      { $inc: { balanceMinor: delta } },
      { returnDocument: "after", session }
    );
    if (!wallet) throw new NotFoundError("Account not found");

    const [tx] = await WalletTx.create(
      [
        {
          userId: owner,
          walletId: wallet._id,
          type: input.type,
          amountMinor: input.amount,
          note: input.note,
          date: input.date ?? new Date(),
        },
      ],
      { session, ordered: true }
    );

    const txCount = await WalletTx.countDocuments({ walletId, userId: owner }).session(
      session ?? null
    );

    return {
      transaction: toTxDTO(tx!),
      balanceMinor: wallet.balanceMinor,
      txCount,
    };
  });
}

export async function deleteTransaction(
  userId: string,
  walletId: string,
  txId: string
): Promise<{ balanceMinor: number; txCount: number }> {
  const owner = new Types.ObjectId(userId);

  return withTransaction(async (session) => {
    const tx = await WalletTx.findOneAndDelete(
      { _id: txId, walletId, userId: owner },
      { session }
    );
    if (!tx) throw new NotFoundError("Transaction not found");

    // Reverse exactly what this transaction contributed.
    const delta = -signedMinor(tx.type, tx.amountMinor);

    const wallet = await Wallet.findOneAndUpdate(
      { _id: walletId, userId: owner },
      { $inc: { balanceMinor: delta } },
      { returnDocument: "after", session }
    );
    if (!wallet) throw new NotFoundError("Account not found");

    const txCount = await WalletTx.countDocuments({ walletId, userId: owner }).session(
      session ?? null
    );

    return { balanceMinor: wallet.balanceMinor, txCount };
  });
}

/**
 * Rebuilds a wallet's cached balance from its transactions.
 *
 * The cache cannot drift under normal operation, but this exists so a balance
 * that was corrupted before the atomic writes landed — or by the
 * non-transactional development fallback — can be reconciled without a manual
 * database edit.
 */
export async function recomputeBalance(
  userId: string,
  walletId: string
): Promise<number> {
  const owner = new Types.ObjectId(userId);

  const [row] = await WalletTx.aggregate<{ balanceMinor: number }>([
    { $match: { walletId: new Types.ObjectId(walletId), userId: owner } },
    {
      $group: {
        _id: null,
        balanceMinor: {
          $sum: {
            $cond: [
              { $eq: ["$type", "credit"] },
              { $ifNull: ["$amountMinor", 0] },
              { $multiply: [{ $ifNull: ["$amountMinor", 0] }, -1] },
            ],
          },
        },
      },
    },
  ]);

  const balanceMinor = row?.balanceMinor ?? 0;

  const wallet = await Wallet.findOneAndUpdate(
    { _id: walletId, userId: owner },
    { $set: { balanceMinor } },
    { returnDocument: "after" }
  ).lean();

  if (!wallet) throw new NotFoundError("Account not found");
  return balanceMinor;
}
