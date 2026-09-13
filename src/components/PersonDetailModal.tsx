"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LedgerPersonWithBalance, LedgerEntryWithBalance, EntryType,
} from "@/lib/types";
import { api, errorMessage } from "@/lib/apiClient";
import { formatMoney } from "@/lib/money";
import { personSettlement, settlementLabel } from "@/lib/ledgerBalance";
import Modal from "@/components/ui/Modal";
import ProgressBar from "@/components/ui/ProgressBar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Money from "@/components/ui/Money";
import TransactionWizard, { TransactionDraft } from "@/components/TransactionWizard";
import { ENTRY_DIRECTIONS } from "@/components/ledger/entryDirections";
import Sparkline from "@/components/ui/Sparkline";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ArrowUpIcon, ArrowDownIcon, TrashIcon, SpinnerIcon,
} from "@/components/ui/icons";

interface PersonDetailModalProps {
  person: LedgerPersonWithBalance;
  onClose: () => void;
  onPersonUpdate: (updated: LedgerPersonWithBalance) => void;
  onPersonDelete: (id: string) => void;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });


export default function PersonDetailModal({
  person, onClose, onPersonUpdate, onPersonDelete,
}: PersonDetailModalProps) {
  const toast = useToast();

  const [entries, setEntries] = useState<LedgerEntryWithBalance[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [deletingEntry, setDeletingEntry] = useState<string | null>(null);
  const [confirmDeletePerson, setConfirmDeletePerson] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoadingEntries(true);
    setLoadError("");
    try {
      setEntries(await api<LedgerEntryWithBalance[]>(`/api/ledger/${person._id}/entries`));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoadingEntries(false);
    }
  }, [person._id]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const totals = useMemo(() => {
    const receivable = entries
      .filter((entry) => entry.type === "receivable")
      .reduce((sum, entry) => sum + entry.amountMinor, 0);
    const payable = entries
      .filter((entry) => entry.type === "payable")
      .reduce((sum, entry) => sum + entry.amountMinor, 0);
    return { receivable, payable, balance: receivable - payable };
  }, [entries]);

  /** Recomputes and lifts the summary the ledger list renders. */
  const syncParent = useCallback(
    (nextEntries: LedgerEntryWithBalance[]) => {
      const receivable = nextEntries
        .filter((entry) => entry.type === "receivable")
        .reduce((sum, entry) => sum + entry.amountMinor, 0);
      const payable = nextEntries
        .filter((entry) => entry.type === "payable")
        .reduce((sum, entry) => sum + entry.amountMinor, 0);
      const latest = nextEntries.reduce<string | null>(
        (accumulator, entry) => (!accumulator || entry.date > accumulator ? entry.date : accumulator),
        null
      );

      onPersonUpdate({
        ...person,
        balanceMinor: receivable - payable,
        totalReceivableMinor: receivable,
        totalPayableMinor: payable,
        lastEntryDate: latest,
        entryCount: nextEntries.length,
      });
    },
    [person, onPersonUpdate]
  );

  const refresh = useCallback(async () => {
    const refreshed = await api<LedgerEntryWithBalance[]>(
      `/api/ledger/${person._id}/entries`
    );
    setEntries(refreshed);
    syncParent(refreshed);
  }, [person._id, syncParent]);

  /*
   * Throws rather than swallowing: `TransactionWizard` keeps the entry on
   * screen and shows the message when the promise rejects, so a failed save
   * must not resolve.
   */
  const handleAddEntry = async (draft: TransactionDraft<EntryType>) => {
    await api(`/api/ledger/${person._id}/entries`, {
      method: "POST",
      body: { type: draft.type, amount: draft.amount, note: draft.note, date: draft.date },
    });
    await refresh();
    toast.success("Transaction added.");
  };

  const handleDeleteEntry = async (entryId: string) => {
    setDeletingEntry(entryId);
    try {
      await api(`/api/ledger/${person._id}/entries/${entryId}`, { method: "DELETE" });
      await refresh();
      toast.success("Transaction removed.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeletingEntry(null);
    }
  };

  const handleDeletePerson = async () => {
    setDeletingPerson(true);
    try {
      await api(`/api/ledger/${person._id}`, { method: "DELETE" });
      onPersonDelete(person._id);
      onClose();
      toast.success(`${person.name} removed.`);
    } catch (error) {
      setDeletingPerson(false);
      setConfirmDeletePerson(false);
      toast.error(errorMessage(error));
    }
  };

  /* The same two totals read as a debt being paid down — see
     `lib/ledgerBalance.ts`. Derived here rather than stored, so it cannot
     disagree with the history rendered underneath it. */
  const settlement = personSettlement({
    totalReceivableMinor: totals.receivable,
    totalPayableMinor: totals.payable,
  });

  // Balance over time, oldest first — `entries` already arrives chronological.
  const balanceHistory = useMemo(
    () => entries.map((entry) => entry.runningBalanceMinor),
    [entries]
  );

  return (
    <>
      <Modal
        title={person.name}
        subtitle={person.note}
        size="lg"
        scrollable
        onClose={onClose}
        headerActions={
          <button
            onClick={() => setConfirmDeletePerson(true)}
            className="btn-ghost w-9 h-9 px-0 text-negative"
            aria-label={`Delete ${person.name}`}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        }
      >
        {/* ── Summary ── */}
        <div className="px-5 sm:px-6 py-4 flex-shrink-0 border-b border-line">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div className="min-w-0">
              {/* "Outstanding" rather than "Net balance": the figure has not
                  changed, but what a person wants from it is how much of the
                  loan is still out, and the old label answered a bookkeeping
                  question nobody was asking. */}
              <p className="text-eyebrow mb-1">Outstanding</p>
              <Money minor={totals.balance} size="lg" signed />
              <p className="text-xs mt-0.5 text-ink-muted">
                {settlementLabel(settlement.side)}
              </p>
            </div>
            <Sparkline
              points={balanceHistory}
              color={totals.balance >= 0 ? "var(--green)" : "var(--red)"}
              className="w-28 h-9 flex-shrink-0"
              label={`${person.name} balance history`}
            />
          </div>

          {/*
            The loan, and how far through it this person is.

            Three figures rather than the two direction totals that were here
            before: "Receivable ৳10,000 / Payable ৳5,000" is the same arithmetic
            said in the language of the database, and it left the reader to work
            out that half the money had come back.
          */}
          {settlement.untouched ? (
            <p className="text-xs text-ink-muted">
              Nothing recorded yet — the first transaction sets the amount.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="well px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink-muted">
                    {settlement.side === "payable" ? "Borrowed" : "Lent"}
                  </p>
                  <Money
                    minor={settlement.principalMinor}
                    size="sm"
                    tone="neutral"
                    className="mt-0.5 block"
                  />
                </div>
                <div className="well px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink-muted">
                    {settlement.side === "payable" ? "Paid" : "Returned"}
                  </p>
                  <Money
                    minor={settlement.paidMinor}
                    size="sm"
                    tone="positive"
                    className="mt-0.5 block"
                  />
                </div>
                <div className="well px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink-muted">Remaining</p>
                  {/* Neutral, not red: this is a magnitude, and money still
                      owed *to* the user is not a negative for them. Direction
                      is carried by the signed figure above. */}
                  <Money
                    minor={settlement.remainingMinor}
                    size="sm"
                    tone={settlement.fullySettled ? "positive" : "neutral"}
                    className="mt-0.5 block"
                  />
                </div>
              </div>

              <ProgressBar
                className="mt-3"
                value={settlement.paidRatio * 100}
                color={settlement.fullySettled ? "var(--green)" : undefined}
                label={`${formatMoney(settlement.paidMinor)} of ${formatMoney(
                  settlement.principalMinor
                )} settled`}
              />
              <p className="text-[11px] mt-1.5 text-ink-muted">
                {settlement.fullySettled
                  ? "Fully settled — every taka accounted for."
                  : `${formatMoney(settlement.paidMinor)} of ${formatMoney(
                      settlement.principalMinor
                    )} settled · ${formatMoney(settlement.remainingMinor)} to go`}
              </p>
            </>
          )}
        </div>

        {/* ── Add entry ── */}
        <div className="px-5 sm:px-6 py-4 flex-shrink-0 border-b border-line">
          <p className="text-eyebrow mb-3">Add transaction</p>
          <TransactionWizard
            directions={ENTRY_DIRECTIONS}
            directionLabel="Transaction direction"
            onSubmit={handleAddEntry}
          />
        </div>

        {/* ── History ── */}
        <div className="flex-1 overflow-y-auto">
          <p className="text-eyebrow px-5 sm:px-6 pt-4 pb-2">History ({entries.length})</p>

          {loadingEntries ? (
            <div className="px-5 sm:px-6 pb-4 flex flex-col gap-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="skeleton h-14 w-full rounded-well" />
              ))}
            </div>
          ) : loadError ? (
            <div className="px-5 sm:px-6 pb-4">
              <p className="alert-error" role="alert">
                {loadError}
              </p>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-center py-10 text-ink-muted">
              No transactions yet — add the first one above.
            </p>
          ) : (
            <ul>
              {/* Newest first for reading; the running balance was computed
                  chronologically before the reverse. */}
              {[...entries].reverse().map((entry) => {
                const positive = entry.type === "receivable";
                const tone = positive ? "var(--green)" : "var(--red)";

                return (
                  <li key={entry._id} className="statement-row group">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `color-mix(in srgb, ${tone} 16%, transparent)`,
                        color: tone,
                      }}
                    >
                      {positive ? (
                        <ArrowUpIcon className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownIcon className="w-3.5 h-3.5" />
                      )}
                    </span>

                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate text-ink">
                        {entry.note ?? (positive ? "Receivable" : "Payable")}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {formatDate(entry.date)}
                      </span>
                    </span>

                    <span className="text-right">
                      <Money
                        minor={positive ? entry.amountMinor : -entry.amountMinor}
                        size="sm"
                        signed
                        className="block"
                      />
                      <span className="block text-[11px] mt-0.5 text-ink-muted">
                        bal <Money minor={entry.runningBalanceMinor} size="sm" tone="inherit" signed />
                      </span>
                    </span>

                    <button
                      onClick={() => handleDeleteEntry(entry._id)}
                      disabled={deletingEntry === entry._id}
                      className="btn-ghost w-8 h-8 px-0 flex-shrink-0 text-negative sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Delete transaction from ${formatDate(entry.date)}`}
                    >
                      {deletingEntry === entry._id ? (
                        <SpinnerIcon className="w-3.5 h-3.5" />
                      ) : (
                        <TrashIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>

      {confirmDeletePerson && (
        <ConfirmDialog
          title={`Delete ${person.name}?`}
          message={`This removes the person and all ${entries.length} transaction${
            entries.length === 1 ? "" : "s"
          }. This cannot be undone.`}
          busy={deletingPerson}
          onConfirm={handleDeletePerson}
          onCancel={() => setConfirmDeletePerson(false)}
        />
      )}
    </>
  );
}
