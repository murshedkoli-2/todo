import { describe, expect, test } from "vitest";
import {
  personSettlement, settlementLabel, settlementProgressLabel,
} from "@/lib/ledgerBalance";

/**
 * The headline figures a person's row and modal print. They are derived from
 * the two stored totals on every read rather than kept as columns of their own,
 * which is what makes the arithmetic here the only thing standing between the
 * history and the number on screen.
 */

const totals = (receivable: number, payable: number) => ({
  totalReceivableMinor: receivable,
  totalPayableMinor: payable,
});

/** Minor units, printed plainly — the tests care about wording, not currency. */
const plain = (minor: number) => `${minor / 100}`;

describe("personSettlement", () => {
  test("reads a part-repaid loan as principal, paid, and remaining", () => {
    // ৳10,000 lent, ৳4,000 back. The netted balance alone cannot say this.
    const settlement = personSettlement(totals(1_000_000, 400_000));

    expect(settlement.side).toBe("receivable");
    expect(settlement.principalMinor).toBe(1_000_000);
    expect(settlement.paidMinor).toBe(400_000);
    expect(settlement.remainingMinor).toBe(600_000);
    expect(settlement.paidRatio).toBeCloseTo(0.4);
    expect(settlement.fullySettled).toBe(false);
  });

  test("mirrors the reading when the user is the one who owes", () => {
    const settlement = personSettlement(totals(300_00, 900_00));

    expect(settlement.side).toBe("payable");
    expect(settlement.principalMinor).toBe(900_00);
    expect(settlement.paidMinor).toBe(300_00);
    expect(settlement.remainingMinor).toBe(600_00);
  });

  test("calls a debt that has come back in full settled", () => {
    const settlement = personSettlement(totals(500_00, 500_00));

    expect(settlement.side).toBe("settled");
    expect(settlement.remainingMinor).toBe(0);
    expect(settlement.paidRatio).toBe(1);
    expect(settlement.fullySettled).toBe(true);
    expect(settlement.untouched).toBe(false);
  });

  test("separates a person with no history from one who has settled up", () => {
    /* Both show a zero balance and they mean opposite things: one has never
       transacted, the other has paid off everything. A row that reads "cleared"
       for somebody who has never owed anything is a small lie the progress bar
       would then draw as a full one. */
    const fresh = personSettlement(totals(0, 0));

    expect(fresh.untouched).toBe(true);
    expect(fresh.fullySettled).toBe(false);
    expect(fresh.side).toBe("settled");
  });

  test("reports a fresh loan as nothing paid rather than dividing by zero", () => {
    const settlement = personSettlement(totals(250_00, 0));

    expect(settlement.paidMinor).toBe(0);
    expect(settlement.paidRatio).toBe(0);
    expect(settlement.remainingMinor).toBe(250_00);
  });

  test("never returns NaN for a person with nothing recorded", () => {
    // `NaN` reaches a progress bar as a silently missing fill, not an error.
    expect(Number.isFinite(personSettlement(totals(0, 0)).paidRatio)).toBe(true);
  });

  test("remaining always equals the netted balance, whichever way it runs", () => {
    const cases: Array<[number, number]> = [
      [1_000, 0], [0, 1_000], [7_500, 2_500], [2_500, 7_500], [4_242, 4_242], [0, 0],
    ];

    for (const [receivable, payable] of cases) {
      const settlement = personSettlement(totals(receivable, payable));
      expect(settlement.remainingMinor).toBe(Math.abs(receivable - payable));
      expect(settlement.principalMinor - settlement.paidMinor)
        .toBe(settlement.remainingMinor);
    }
  });

  test("treats a negative stored total as zero rather than inverting the reading", () => {
    // No write path produces one; a corrupted document should degrade to an
    // understated balance, not to a principal smaller than what was repaid.
    const settlement = personSettlement(totals(-500, 200));

    expect(settlement.principalMinor).toBe(200);
    expect(settlement.paidMinor).toBe(0);
    expect(settlement.side).toBe("payable");
  });
});

describe("settlementLabel", () => {
  test("says which way the balance runs, or that it is closed", () => {
    expect(settlementLabel("receivable")).toBe("They owe you");
    expect(settlementLabel("payable")).toBe("You owe them");
    expect(settlementLabel("settled")).toBe("Settled up");
  });
});

describe("settlementProgressLabel", () => {
  test("says how much of the loan has come back", () => {
    expect(settlementProgressLabel(personSettlement(totals(1000, 400)), plain))
      .toBe("4 of 10 back");
  });

  test("says 'paid' when the user is the one paying it down", () => {
    expect(settlementProgressLabel(personSettlement(totals(400, 1000)), plain))
      .toBe("4 of 10 paid");
  });

  test("marks a closed balance as cleared", () => {
    expect(settlementProgressLabel(personSettlement(totals(1000, 1000)), plain))
      .toBe("10 of 10 — cleared");
  });

  test("says nothing about a loan nothing has been paid against", () => {
    // "৳0 of ৳5,000 back" is a longer way of writing the balance already on
    // the row, and it would push the person's note off a dense line for it.
    expect(settlementProgressLabel(personSettlement(totals(5000, 0)), plain)).toBeNull();
  });

  test("says nothing about a person with no history", () => {
    expect(settlementProgressLabel(personSettlement(totals(0, 0)), plain)).toBeNull();
  });
});
