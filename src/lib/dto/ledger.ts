import type { Types } from "mongoose";
import { readMinor } from "@/lib/money";
import type { EntryType } from "@/lib/schemas/ledger";

export interface LedgerPersonDTO {
  _id: string;
  userId: string;
  name: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerPersonWithBalanceDTO extends LedgerPersonDTO {
  /** Positive = net receivable (they owe you). Integer minor units. */
  balanceMinor: number;
  totalReceivableMinor: number;
  totalPayableMinor: number;
  lastEntryDate: string | null;
  entryCount: number;
}

export interface LedgerEntryDTO {
  _id: string;
  personId: string;
  userId: string;
  type: EntryType;
  amountMinor: number;
  note?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntryWithBalanceDTO extends LedgerEntryDTO {
  /** Balance after this entry, recomputed from the ordered ledger on read. */
  runningBalanceMinor: number;
}

interface PersonSource {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  name: string;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface EntrySource {
  _id: Types.ObjectId | string;
  personId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  type: string;
  amountMinor?: number | null;
  amount?: number | null;
  note?: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Balance totals produced by the aggregation in `ledger.service`. */
export interface PersonTotals {
  totalReceivableMinor: number;
  totalPayableMinor: number;
  lastEntryDate: Date | null;
  entryCount: number;
}

export const EMPTY_TOTALS: PersonTotals = {
  totalReceivableMinor: 0,
  totalPayableMinor: 0,
  lastEntryDate: null,
  entryCount: 0,
};

export function toPersonDTO(source: PersonSource): LedgerPersonDTO {
  return {
    _id: source._id.toString(),
    userId: source.userId.toString(),
    name: source.name,
    note: source.note ?? undefined,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

export function toPersonWithBalanceDTO(
  source: PersonSource,
  totals: PersonTotals = EMPTY_TOTALS
): LedgerPersonWithBalanceDTO {
  return {
    ...toPersonDTO(source),
    balanceMinor: totals.totalReceivableMinor - totals.totalPayableMinor,
    totalReceivableMinor: totals.totalReceivableMinor,
    totalPayableMinor: totals.totalPayableMinor,
    lastEntryDate: totals.lastEntryDate ? totals.lastEntryDate.toISOString() : null,
    entryCount: totals.entryCount,
  };
}

export function toEntryDTO(source: EntrySource): LedgerEntryDTO {
  return {
    _id: source._id.toString(),
    personId: source.personId.toString(),
    userId: source.userId.toString(),
    type: source.type as EntryType,
    amountMinor: readMinor(source.amountMinor, source.amount),
    note: source.note ?? undefined,
    date: source.date.toISOString(),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

/**
 * Maps entries in chronological order, attaching the running balance as it
 * goes. Computing this on read is what makes deleting or back-dating an entry
 * safe — there is no stored snapshot left describing a balance that no longer
 * exists.
 */
export function toEntriesWithRunningBalance(
  chronologicalEntries: readonly EntrySource[]
): LedgerEntryWithBalanceDTO[] {
  let runningBalanceMinor = 0;

  return chronologicalEntries.map((source) => {
    const entry = toEntryDTO(source);
    runningBalanceMinor +=
      entry.type === "receivable" ? entry.amountMinor : -entry.amountMinor;
    return { ...entry, runningBalanceMinor };
  });
}
