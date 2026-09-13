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
import { tidyPersonName } from "@/lib/ledgerPeople";
import { withTransaction } from "@/server/withTransaction";
import type {
  CreateEntryInput, CreatePersonInput, QuickEntryInput, UpdatePersonInput,
} from "@/lib/schemas/ledger";

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
 *
 * `personId` narrows the same pipeline to one counterparty, for the writes that
 * need to hand back a single settled row. Sharing the pipeline rather than
 * summing that one person a second way is what keeps a balance returned from a
 * write equal to the balance the list reports on the next load.
 */
async function personTotals(
  userId: Types.ObjectId,
  personId?: Types.ObjectId
): Promise<Map<string, PersonTotals>> {
  const amountMinor = {
    $ifNull: ["$amountMinor", { $round: [{ $multiply: [{ $ifNull: ["$amount", 0] }, 100] }, 0] }],
  };

  const rows = await LedgerEntry.aggregate<TotalsRow>([
    { $match: personId ? { userId, personId } : { userId } },
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

/**
 * Adds an entry and, when the counterparty is new, the counterparty with it.
 *
 * This is the write behind the ledger page's quick add. Doing it in one call
 * rather than "create the person, then post the entry" is not a round-trip
 * optimisation: the two-call version fails between its halves often enough to
 * matter — a dropped connection after the first leaves a person in the book
 * with no entries and no balance, which reads as a mistake the user has to
 * clean up rather than as a save that did not happen.
 *
 * A typed name that already belongs to somebody attaches to them instead of
 * creating a second row. Matching is case-insensitive through a collation
 * rather than a regex, so no user input reaches a pattern; the client applies
 * the same rule through `findPersonByName` and says which person the entry is
 * about to land on, so this is a backstop for a fast typist, not a surprise.
 *
 * Returns the person with their settled balance, because the caller is a list
 * that has just changed by this amount and would otherwise have to refetch the
 * whole book to redraw one row.
 */
export async function createQuickEntry(
  userId: string,
  input: QuickEntryInput
): Promise<{
  person: LedgerPersonWithBalanceDTO;
  entry: LedgerEntryDTO;
  /** True when this write is what put the person in the book. */
  personCreated: boolean;
}> {
  const owner = new Types.ObjectId(userId);

  const { person, entry, personCreated } = await withTransaction(async (session) => {
    /* Either half can fail — a stale id from a list loaded before a delete, or
       the create — and neither may leave the other behind, which is the whole
       reason this is one transaction rather than two writes. */
    const existing = input.personId
      ? await Ledger.findOne({ _id: input.personId, userId: owner }).session(session ?? null)
      : await Ledger.findOne({ userId: owner, name: tidyPersonName(input.personName!) })
          .collation({ locale: "en", strength: 2 })
          .session(session ?? null);

    if (!existing && input.personId) throw new NotFoundError("Person not found");

    const [created] = existing
      ? [existing]
      : await Ledger.create(
          [{ userId: owner, name: tidyPersonName(input.personName!) }],
          { session, ordered: true }
        );

    const [written] = await LedgerEntry.create(
      [
        {
          userId: owner,
          personId: created!._id,
          type: input.type,
          amountMinor: input.amount,
          note: input.note,
          date: input.date ?? new Date(),
        },
      ],
      { session, ordered: true }
    );

    return { person: created!, entry: written!, personCreated: !existing };
  });

  /* Read back outside the transaction: the totals are a consequence of the
     write, not part of it, and re-reading them is what makes the row handed to
     the client agree with the one the next page load will show. */
  const totals = await personTotals(owner, person._id as Types.ObjectId);

  return {
    person: toPersonWithBalanceDTO(person, totals.get(person._id.toString()) ?? EMPTY_TOTALS),
    entry: toEntryDTO(entry),
    personCreated,
  };
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
