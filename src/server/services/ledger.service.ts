import { Types } from "mongoose";
import Ledger from "@/models/Ledger";
import LedgerEntry from "@/models/LedgerEntry";
import {
  EMPTY_TOTALS, toEntriesWithRunningBalance, toEntryDTO, toPersonDTO,
  toPersonWithBalanceDTO,
  type LedgerEntryDTO, type LedgerEntryWithBalanceDTO,
  type LedgerPersonDTO, type LedgerPersonWithBalanceDTO, type PersonTotals,
} from "@/lib/dto/ledger";
import { NotFoundError } from "@/lib/api/errors";
import { withTransaction } from "@/server/withTransaction";
import type { CreateEntryInput, CreatePersonInput, UpdatePersonInput } from "@/lib/schemas/ledger";

interface TotalsRow {
  _id: Types.ObjectId;
  totalReceivableMinor: number;
  totalPayableMinor: number;
  lastEntryDate: Date | null;
  entryCount: number;
}

/**
 * Per-person totals for one user, in a single round trip.
 *
 * This replaces a loop that issued one `find()` per person and summed in Node —
 * 51 queries for 50 people, on every page view. `$cond` splits the sum by
 * direction so both totals come out of one pass.
 *
 * `$ifNull` reads the pre-migration float column when the minor-unit field is
 * absent, multiplying by 100 so both generations of document sum in the same
 * unit. Once `scripts/migrate-money.mjs` has run, the fallback branch is dead.
 */
async function personTotals(userId: Types.ObjectId): Promise<Map<string, PersonTotals>> {
  const amountMinor = {
    $ifNull: ["$amountMinor", { $round: [{ $multiply: [{ $ifNull: ["$amount", 0] }, 100] }, 0] }],
  };

  const rows = await LedgerEntry.aggregate<TotalsRow>([
    { $match: { userId } },
    {
      $group: {
        _id: "$personId",
        totalReceivableMinor: {
          $sum: { $cond: [{ $eq: ["$type", "receivable"] }, amountMinor, 0] },
        },
        totalPayableMinor: {
          $sum: { $cond: [{ $eq: ["$type", "payable"] }, amountMinor, 0] },
        },
        lastEntryDate: { $max: "$date" },
        entryCount: { $sum: 1 },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      row._id.toString(),
      {
        totalReceivableMinor: row.totalReceivableMinor,
        totalPayableMinor: row.totalPayableMinor,
        lastEntryDate: row.lastEntryDate,
        entryCount: row.entryCount,
      },
    ])
  );
}

export async function listPersons(
  userId: string
): Promise<LedgerPersonWithBalanceDTO[]> {
  const owner = new Types.ObjectId(userId);

  const [persons, totals] = await Promise.all([
    Ledger.find({ userId: owner }).sort({ createdAt: -1 }).lean(),
    personTotals(owner),
  ]);

  return persons.map((person) =>
    toPersonWithBalanceDTO(person, totals.get(person._id.toString()) ?? EMPTY_TOTALS)
  );
}

export async function getPersonWithEntries(
  userId: string,
  personId: string
): Promise<{ person: LedgerPersonWithBalanceDTO; entries: LedgerEntryWithBalanceDTO[] }> {
  const owner = new Types.ObjectId(userId);

  const person = await Ledger.findOne({ _id: personId, userId: owner }).lean();
  if (!person) throw new NotFoundError("Person not found");

  const documents = await LedgerEntry.find({ personId, userId: owner })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  const entries = toEntriesWithRunningBalance(documents);

  const totals: PersonTotals = entries.reduce<PersonTotals>(
    (accumulator, entry) => ({
      totalReceivableMinor:
        accumulator.totalReceivableMinor +
        (entry.type === "receivable" ? entry.amountMinor : 0),
      totalPayableMinor:
        accumulator.totalPayableMinor + (entry.type === "payable" ? entry.amountMinor : 0),
      lastEntryDate: new Date(entry.date),
      entryCount: accumulator.entryCount + 1,
    }),
    { ...EMPTY_TOTALS }
  );

  return { person: toPersonWithBalanceDTO(person, totals), entries };
}

export async function listEntries(
  userId: string,
  personId: string
): Promise<LedgerEntryWithBalanceDTO[]> {
  const documents = await LedgerEntry.find({
    personId,
    userId: new Types.ObjectId(userId),
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  return toEntriesWithRunningBalance(documents);
}

export async function createPerson(
  userId: string,
  input: CreatePersonInput
): Promise<LedgerPersonWithBalanceDTO> {
  const owner = new Types.ObjectId(userId);

  return withTransaction(async (session) => {
    const [person] = await Ledger.create(
      [{ userId: owner, name: input.name, note: input.note }],
      { session, ordered: true }
    );

    if (!input.initialAmount) {
      return toPersonWithBalanceDTO(person!);
    }

    const now = new Date();
    await LedgerEntry.create(
      [
        {
          userId: owner,
          personId: person!._id,
          type: input.initialType,
          amountMinor: input.initialAmount,
          note: "Opening balance",
          date: now,
        },
      ],
      { session, ordered: true }
    );

    const receivable = input.initialType === "receivable";
    return toPersonWithBalanceDTO(person!, {
      totalReceivableMinor: receivable ? input.initialAmount : 0,
      totalPayableMinor: receivable ? 0 : input.initialAmount,
      lastEntryDate: now,
      entryCount: 1,
    });
  });
}

export async function updatePerson(
  userId: string,
  personId: string,
  input: UpdatePersonInput
): Promise<LedgerPersonDTO> {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};

  if (input.name !== undefined) set.name = input.name;
  if ("note" in input) {
    if (input.note) set.note = input.note;
    else unset.note = "";
  }

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;

  const person = await Ledger.findOneAndUpdate(
    { _id: personId, userId: new Types.ObjectId(userId) },
    update,
    { returnDocument: "after", runValidators: true }
  ).lean();

  if (!person) throw new NotFoundError("Person not found");
  return toPersonDTO(person);
}

export async function deletePerson(userId: string, personId: string): Promise<void> {
  const owner = new Types.ObjectId(userId);

  await withTransaction(async (session) => {
    const person = await Ledger.findOneAndDelete(
      { _id: personId, userId: owner },
      { session }
    );
    if (!person) throw new NotFoundError("Person not found");

    // Entries are meaningless without their counterparty, so they go together.
    await LedgerEntry.deleteMany({ personId, userId: owner }, { session });
  });
}

export async function createEntry(
  userId: string,
  personId: string,
  input: CreateEntryInput
): Promise<LedgerEntryDTO> {
  const owner = new Types.ObjectId(userId);

  // Confirms the counterparty is this user's before writing an entry that
  // would otherwise be orphaned under someone else's person id.
  const person = await Ledger.exists({ _id: personId, userId: owner });
  if (!person) throw new NotFoundError("Person not found");

  const entry = await LedgerEntry.create({
    userId: owner,
    personId: new Types.ObjectId(personId),
    type: input.type,
    amountMinor: input.amount,
    note: input.note,
    date: input.date ?? new Date(),
  });

  return toEntryDTO(entry);
}

export async function deleteEntry(
  userId: string,
  personId: string,
  entryId: string
): Promise<void> {
  const result = await LedgerEntry.findOneAndDelete({
    _id: entryId,
    personId,
    userId: new Types.ObjectId(userId),
  }).lean();

  if (!result) throw new NotFoundError("Entry not found");
}
