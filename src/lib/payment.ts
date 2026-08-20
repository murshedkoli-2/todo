/**
 * Payment arithmetic for a task.
 *
 * A task carries a **total cost** (what the job is worth) and a **paid**
 * amount (what has come in so far). Everything else — what is still due, and
 * whether the task counts as unpaid, part-paid or settled — is derived from
 * those two figures rather than stored beside them and allowed to drift.
 *
 * Both amounts are integer minor units throughout; see `lib/money.ts` for why
 * a float never touches a stored amount.
 */

import type { PaymentStatus } from "@/lib/schemas/todo";

/**
 * Payment status implied by the two amounts.
 *
 * This replaces a selector the user had to keep in sync by hand, which meant a
 * task could read "৳13,500 · UNPAID" long after the money had arrived. The
 * numbers are the source of truth now, and the badge follows them.
 *
 * An overpayment counts as settled rather than as a fourth state: taking more
 * than the agreed price is a bookkeeping matter, not an outstanding debt.
 */
export function derivePaymentStatus(
  totalMinor: number | null | undefined,
  paidMinor: number | null | undefined
): PaymentStatus {
  const paid = paidMinor ?? 0;
  if (paid <= 0) return "unpaid";

  const total = totalMinor ?? 0;
  // With no total recorded, whatever was paid is all that was ever owed.
  if (total <= 0 || paid >= total) return "paid";

  return "partial";
}

/**
 * What is still owed, or `null` when there is no total to owe against.
 *
 * Never negative: an overpayment shows as nothing due rather than as a
 * negative balance, which would read as the task owing money back.
 */
export function dueMinor(
  totalMinor: number | null | undefined,
  paidMinor: number | null | undefined
): number | null {
  if (totalMinor == null) return null;
  return Math.max(0, totalMinor - (paidMinor ?? 0));
}

/**
 * Paid amount for a task written before the field existed.
 *
 * Those rows recorded only a total and a hand-set status, so the amount paid
 * has to be inferred from it: a settled task had received its full total, an
 * unpaid one had received nothing. `partial` is the one case that cannot be
 * recovered — the row says money arrived but never said how much — so it
 * returns `null` and the UI asks rather than inventing a figure.
 */
export function legacyPaidMinor(
  totalMinor: number | null | undefined,
  status: PaymentStatus | null | undefined
): number | null {
  if (status === "paid") return totalMinor ?? null;
  if (status === "unpaid") return 0;
  return null;
}
