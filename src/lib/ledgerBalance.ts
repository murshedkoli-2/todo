/**
 * A person's balance read as a debt being paid down.
 *
 * The ledger stores two directions and nets them, which answers "where do we
 * stand" and nothing else. It cannot answer the question people actually ask
 * about a loan — *how much of it has come back* — because ৳5,000 outstanding
 * looks identical whether it is half of ৳10,000 already half repaid or a fresh
 * ৳5,000 nobody has paid a taka against.
 *
 * So the same two totals are read a second way here: the larger side is the
 * principal, the smaller is what has come back against it, and the difference
 * is what is left. Nothing new is stored. A principal kept as its own column
 * would be a second copy of a fact the entries already carry, and the first
 * edit or deletion that touched an entry without touching the column would
 * leave the person's headline figure quietly lying about their own history —
 * the failure this module exists to avoid, not to introduce.
 *
 * One consequence worth stating: money borrowed *from* somebody you have lent
 * to counts here as repayment. It is not one, but it moves what they owe you
 * by exactly the same amount, and the netted balance has always treated the
 * two identically. This module reports the balance, it does not re-interpret
 * it.
 */

/** Which way the net runs, or `settled` when the two sides cancel out. */
export type LedgerSide = "receivable" | "payable" | "settled";

/** The two stored sums every read path already carries. */
export interface PersonTotalsInput {
  totalReceivableMinor: number;
  totalPayableMinor: number;
}

export interface PersonSettlement {
  side: LedgerSide;
  /** The larger side: everything raised in the direction the balance runs. */
  principalMinor: number;
  /** The smaller side: what has come back against it. */
  paidMinor: number;
  /** What is still outstanding — the same figure as `|balance|`. */
  remainingMinor: number;
  /** `paid / principal`, clamped to 0–1, for a progress bar. */
  paidRatio: number;
  /** Something was owed and every taka of it has come back. */
  fullySettled: boolean;
  /** Nothing recorded at all — a person added but never transacted with. */
  untouched: boolean;
}

export function personSettlement(totals: PersonTotalsInput): PersonSettlement {
  const receivable = Math.max(0, totals.totalReceivableMinor);
  const payable = Math.max(0, totals.totalPayableMinor);

  const principalMinor = Math.max(receivable, payable);
  const paidMinor = Math.min(receivable, payable);
  const remainingMinor = principalMinor - paidMinor;

  const side: LedgerSide =
    receivable > payable ? "receivable" : payable > receivable ? "payable" : "settled";

  return {
    side,
    principalMinor,
    paidMinor,
    remainingMinor,
    /* Guarded rather than assumed: a person with no entries divides by zero,
       and `NaN` reaches a progress bar as a silently missing fill rather than
       as an error anybody would notice. */
    paidRatio: principalMinor > 0 ? paidMinor / principalMinor : 0,
    fullySettled: principalMinor > 0 && remainingMinor === 0,
    untouched: principalMinor === 0,
  };
}

/** The headline, in the words the rest of the ledger already uses. */
export function settlementLabel(side: LedgerSide): string {
  if (side === "receivable") return "They owe you";
  return side === "payable" ? "You owe them" : "Settled up";
}

/**
 * The one line that says how far through a debt this person is.
 *
 * Returns `null` when there is nothing to say — no entries, or a debt nothing
 * has been paid against, where "৳0 of ৳5,000 back" is a longer way of writing
 * the balance that is already on the row.
 */
export function settlementProgressLabel(
  settlement: PersonSettlement,
  format: (minor: number) => string
): string | null {
  if (settlement.untouched || settlement.paidMinor === 0) return null;

  const { paidMinor, principalMinor, side } = settlement;
  const back = `${format(paidMinor)} of ${format(principalMinor)}`;

  if (settlement.fullySettled) return `${back} — cleared`;
  // "back" reads right for money owed *to* the user; for the other direction
  // the user is the one paying, so it is money "paid".
  return side === "receivable" ? `${back} back` : `${back} paid`;
}
