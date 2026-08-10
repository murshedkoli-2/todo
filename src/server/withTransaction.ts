import mongoose, { type ClientSession } from "mongoose";

/**
 * Mongo only supports multi-document transactions on a replica set or sharded
 * cluster. Atlas is always a replica set; a plain local `mongod` is not, and
 * failing there would make the app unrunnable in development.
 *
 * So we attempt a transaction, and on the specific "not supported" errors fall
 * back to running the same work without a session. That fallback is still
 * correct for lost updates — every balance mutation uses `$inc`, which is
 * atomic per document — it only gives up cross-collection atomicity, which is
 * an acceptable development-only trade.
 */

let transactionsUnsupported = false;

const UNSUPPORTED_MARKERS = [
  "Transaction numbers are only allowed on a replica set",
  "Transactions are not supported",
  "This MongoDB deployment does not support retryable writes",
  "IllegalOperation",
];

function isUnsupported(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return UNSUPPORTED_MARKERS.some((marker) => error.message.includes(marker));
}

export type TransactionalWork<T> = (session?: ClientSession) => Promise<T>;

export async function withTransaction<T>(work: TransactionalWork<T>): Promise<T> {
  if (transactionsUnsupported) return work(undefined);

  let session: ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session!);
    });
    return result;
  } catch (error) {
    if (isUnsupported(error)) {
      // Latch so every later call skips the failed handshake.
      transactionsUnsupported = true;
      console.warn(
        "MongoDB transactions unavailable (standalone server?) — " +
          "falling back to non-transactional writes. Balances stay correct via " +
          "atomic $inc, but multi-collection writes are not all-or-nothing."
      );
      return work(undefined);
    }
    throw error;
  } finally {
    await session?.endSession();
  }
}

/** Test seam — resets the "unsupported" latch between cases. */
export function __resetTransactionSupport(): void {
  transactionsUnsupported = false;
}
