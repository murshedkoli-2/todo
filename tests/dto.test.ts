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

  test("defaults missing collections and codes", () => {
    const dto = toTodoDTO(base);
    expect(dto.images).toEqual([]);
    expect(dto.paymentCurrency).toBe("BDT");
    expect(dto.paymentStatus).toBe("unpaid");
    expect(dto.featureImage).toBeNull();
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
