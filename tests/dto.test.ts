import { describe, expect, test } from "vitest";
import { toTodoDTO } from "@/lib/dto/todo";
import { toEntriesWithRunningBalance, toPersonWithBalanceDTO } from "@/lib/dto/ledger";
import { toTxsWithRunningBalance, toWalletDTO } from "@/lib/dto/wallet";

const CREATED = new Date("2026-01-01T00:00:00.000Z");
const UPDATED = new Date("2026-01-02T00:00:00.000Z");

const baseDates = { createdAt: CREATED, updatedAt: UPDATED };

describe("toTodoDTO", () => {
  const base = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    title: "Write tests",
    status: "todo",
    ...baseDates,
  };

  test("serialises dates to ISO strings", () => {
    const dto = toTodoDTO(base);
    expect(dto.createdAt).toBe(CREATED.toISOString());
    expect(dto.dueDate).toBeNull();
  });

  test("reports no payment as null rather than zero", () => {
    // Zero is a real amount; conflating it with "unset" is how a ৳0 invoice
    // becomes indistinguishable from a task with no payment at all.
    expect(toTodoDTO(base).paymentAmountMinor).toBeNull();
  });

  test("passes through the migrated minor-unit amount", () => {
    expect(toTodoDTO({ ...base, paymentAmountMinor: 4999 }).paymentAmountMinor).toBe(4999);
  });

  test("falls back to the legacy float column", () => {
    expect(toTodoDTO({ ...base, paymentAmount: 49.99 }).paymentAmountMinor).toBe(4999);
  });

  test("preserves a genuine zero amount", () => {
    expect(toTodoDTO({ ...base, paymentAmountMinor: 0 }).paymentAmountMinor).toBe(0);
  });

  test("passes a stored service set through unchanged", () => {
    const dto = toTodoDTO({ ...base, services: ["new_nid", "police_clearance"] });
    expect(dto.services).toEqual(["new_nid", "police_clearance"]);
  });

  test("gives every stored service a sub-task row", () => {
    const dto = toTodoDTO({ ...base, services: ["new_nid", "police_clearance"] });
    expect(dto.subtasks.map((s) => s.service)).toEqual(dto.services);
  });

  test("rebuilds captured fields from the stored pair array", () => {
    const dto = toTodoDTO({
      ...base,
      services: ["birth_certificate_correction"],
      subtasks: [
        {
          service: "birth_certificate_correction",
          done: true,
          fields: [{ key: "birth_number", value: "19998812345678901" }],
        },
      ],
    });
    expect(dto.subtasks[0]).toEqual({
      service: "birth_certificate_correction",
      done: true,
      fields: { birth_number: "19998812345678901" },
    });
  });

  test("keeps a credential on the single-task read, where it is needed", () => {
    const dto = toTodoDTO({
      ...base,
      services: ["nid_correction"],
      subtasks: [
        { service: "nid_correction", done: false, fields: [{ key: "password", value: "s3cret" }] },
      ],
    });
    expect(dto.subtasks[0].fields.password).toBe("s3cret");
  });

  test("strips a credential when the caller asks for redaction", () => {
    // What the list endpoint does. A password has no business riding along in
    // a response that only needed titles.
    const dto = toTodoDTO(
      {
        ...base,
        services: ["nid_correction"],
        subtasks: [
          {
            service: "nid_correction",
            done: false,
            fields: [
              { key: "nid_number", value: "123" },
              { key: "password", value: "s3cret" },
            ],
          },
        ],
      },
      "Me",
      { redactSecrets: true }
    );
    expect(dto.subtasks[0].fields).toEqual({ nid_number: "123" });
    expect(JSON.stringify(dto)).not.toContain("s3cret");
  });

  test("drops a sub-task whose service is no longer selected", () => {
    // Guards the one way the two stored fields can disagree.
    const dto = toTodoDTO({
      ...base,
      services: ["new_nid"],
      subtasks: [
        { service: "nid_correction", done: false, fields: [{ key: "password", value: "s3cret" }] },
        { service: "new_nid", done: false, fields: [] },
      ],
    });
    expect(dto.subtasks.map((s) => s.service)).toEqual(["new_nid"]);
    expect(JSON.stringify(dto)).not.toContain("s3cret");
  });

  test("reads a task written before services existed as an empty set", () => {
    // The field is absent on every pre-migration document; the client branches
    // on `.length`, so it must arrive as an array rather than undefined.
    expect(toTodoDTO(base).services).toEqual([]);
  });

  test("drops a value that is no longer in the catalogue", () => {
    // A retired service would otherwise reach the client as a key with no
    // label and render as a blank chip.
    const dto = toTodoDTO({ ...base, services: ["new_nid", "trade_licence"] });
    expect(dto.services).toEqual(["new_nid"]);
  });

  test("defaults missing collections and codes", () => {
    const dto = toTodoDTO(base);
    expect(dto.images).toEqual([]);
    expect(dto.paymentCurrency).toBe("BDT");
    expect(dto.paymentStatus).toBe("unpaid");
    expect(dto.paymentMethod).toBe("unset");
    expect(dto.featureImage).toBeNull();
  });

  test("passes through a stored paid amount and derives what is due", () => {
    const dto = toTodoDTO({
      ...base,
      paymentAmountMinor: 1_350_000,
      paidAmountMinor: 750_000,
      paymentStatus: "partial",
    });

    expect(dto.paymentAmountMinor).toBe(1_350_000);
    expect(dto.paidAmountMinor).toBe(750_000);
    expect(dto.dueAmountMinor).toBe(600_000);
  });

  test("preserves a paid amount of zero rather than treating it as unset", () => {
    const dto = toTodoDTO({ ...base, paymentAmountMinor: 5000, paidAmountMinor: 0 });

    expect(dto.paidAmountMinor).toBe(0);
    expect(dto.dueAmountMinor).toBe(5000);
  });

  /*
   * Rows predating the paid column carry only a total and a hand-set status.
   * Reading them back has to agree with what the user meant, or opening an old
   * task would restate its payment on screen and then save that restatement.
   */
  test("infers a legacy settled row as fully paid, leaving nothing due", () => {
    const dto = toTodoDTO({
      ...base,
      paymentAmountMinor: 1_300_000,
      paymentStatus: "paid",
    });

    expect(dto.paidAmountMinor).toBe(1_300_000);
    expect(dto.dueAmountMinor).toBe(0);
  });

  test("infers a legacy unpaid row as nothing received, all of it due", () => {
    const dto = toTodoDTO({
      ...base,
      paymentAmountMinor: 1_300_000,
      paymentStatus: "unpaid",
    });

    expect(dto.paidAmountMinor).toBe(0);
    expect(dto.dueAmountMinor).toBe(1_300_000);
  });

  test("declines to invent a figure for a legacy partial row", () => {
    const dto = toTodoDTO({
      ...base,
      paymentAmountMinor: 1_300_000,
      paymentStatus: "partial",
    });

    expect(dto.paidAmountMinor).toBeNull();
    // The total is still owed as far as anything can tell; the form asks.
    expect(dto.dueAmountMinor).toBe(1_300_000);
  });

  test("reports no due amount when there is no total to owe against", () => {
    expect(toTodoDTO(base).dueAmountMinor).toBeNull();
  });
});

describe("toEntriesWithRunningBalance", () => {
  const entry = (type: string, amountMinor: number, day: number) => ({
    _id: `e${day}`,
    personId: "p1",
    userId: "u1",
    type,
    amountMinor,
    date: new Date(`2026-01-0${day}T00:00:00.000Z`),
    ...baseDates,
  });

  test("accumulates receivables up and payables down", () => {
    const entries = toEntriesWithRunningBalance([
      entry("receivable", 10000, 1),
      entry("payable", 3000, 2),
      entry("receivable", 500, 3),
    ]);

    expect(entries.map((e) => e.runningBalanceMinor)).toEqual([10000, 7000, 7500]);
  });

  test("recomputes cleanly when an entry is removed", () => {
    // This is the whole point of dropping the stored snapshot: deleting the
    // middle row used to leave every later row describing a balance that never
    // existed.
    const entries = toEntriesWithRunningBalance([
      entry("receivable", 10000, 1),
      entry("receivable", 500, 3),
    ]);

    expect(entries.map((e) => e.runningBalanceMinor)).toEqual([10000, 10500]);
  });

  test("handles an empty ledger", () => {
    expect(toEntriesWithRunningBalance([])).toEqual([]);
  });
});

describe("toPersonWithBalanceDTO", () => {
  const person = {
    _id: "p1",
    userId: "u1",
    name: "Rahim",
    ...baseDates,
  };

  test("derives the balance from the two totals", () => {
    const dto = toPersonWithBalanceDTO(person, {
      totalReceivableMinor: 10000,
      totalPayableMinor: 2500,
      lastEntryDate: CREATED,
      entryCount: 4,
    });

    expect(dto.balanceMinor).toBe(7500);
    expect(dto.lastEntryDate).toBe(CREATED.toISOString());
  });

  test("defaults to a zero balance with no entries", () => {
    const dto = toPersonWithBalanceDTO(person);
    expect(dto.balanceMinor).toBe(0);
    expect(dto.entryCount).toBe(0);
    expect(dto.lastEntryDate).toBeNull();
  });

  test("goes negative when payables exceed receivables", () => {
    const dto = toPersonWithBalanceDTO(person, {
      totalReceivableMinor: 100,
      totalPayableMinor: 900,
      lastEntryDate: null,
      entryCount: 2,
    });
    expect(dto.balanceMinor).toBe(-800);
  });
});

describe("wallet DTOs", () => {
  const tx = (type: string, amountMinor: number, day: number) => ({
    _id: `t${day}`,
    walletId: "w1",
    userId: "u1",
    type,
    amountMinor,
    date: new Date(`2026-01-0${day}T00:00:00.000Z`),
    ...baseDates,
  });

  test("running balance follows credits and debits", () => {
    const txs = toTxsWithRunningBalance([
      tx("credit", 50000, 1),
      tx("debit", 12500, 2),
      tx("debit", 7500, 3),
    ]);

    expect(txs.map((t) => t.runningBalanceMinor)).toEqual([50000, 37500, 30000]);
  });

  test("can go negative — an overdrawn account is representable", () => {
    const txs = toTxsWithRunningBalance([tx("credit", 100, 1), tx("debit", 500, 2)]);
    expect(txs[1]!.runningBalanceMinor).toBe(-400);
  });

  test("toWalletDTO reads the legacy float balance", () => {
    const dto = toWalletDTO(
      { _id: "w1", userId: "u1", name: "Cash", accountType: "cash", balance: 1234.5, ...baseDates },
      3
    );
    expect(dto.balanceMinor).toBe(123450);
    expect(dto.txCount).toBe(3);
  });

  test("toWalletDTO prefers the migrated column", () => {
    const dto = toWalletDTO({
      _id: "w1", userId: "u1", name: "Cash", accountType: "cash",
      balanceMinor: 999, balance: 1234.5, ...baseDates,
    });
    expect(dto.balanceMinor).toBe(999);
  });
});
