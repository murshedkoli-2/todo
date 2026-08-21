"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LedgerPersonWithBalance, LedgerEntryWithBalance, EntryType,
} from "@/lib/types";
import { api, errorMessage } from "@/lib/apiClient";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Money from "@/components/ui/Money";
import TransactionWizard, { DirectionChoice, TransactionDraft } from "@/components/TransactionWizard";
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

const ENTRY_DIRECTIONS: ReadonlyArray<DirectionChoice<EntryType>> = [
  {
    value: "receivable",
    label: "They owe me",
    copy: "Money you lent or are owed",
    color: "var(--green)",
    onColor: "var(--on-green)",
    icon: <ArrowUpIcon className="w-4 h-4" />,
    sign: 1,
  },
  {
    value: "payable",
    label: "I owe them",
    copy: "Money you borrowed or must pay",
    color: "var(--red)",
    onColor: "var(--on-red)",
    icon: <ArrowDownIcon className="w-4 h-4" />,
    sign: -1,
  },
];

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
              <p className="text-eyebrow mb-1">Net balance</p>
              <Money minor={totals.balance} size="lg" signed />
              <p className="text-xs mt-0.5 text-ink-muted">
                {totals.balance >= 0 ? "They owe you" : "You owe them"}
              </p>
            </div>
            <Sparkline
              points={balanceHistory}
              color={totals.balance >= 0 ? "var(--green)" : "var(--red)"}
              className="w-28 h-9 flex-shrink-0"
              label={`${person.name} balance history`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="well px-3 py-2.5">
              <p className="text-[11px] font-semibold text-ink-muted">Receivable</p>
              <Money minor={totals.receivable} size="sm" tone="positive" className="mt-0.5 block" />
            </div>
            <div className="well px-3 py-2.5">
              <p className="text-[11px] font-semibold text-ink-muted">Payable</p>
              <Money minor={totals.payable} size="sm" tone="negative" className="mt-0.5 block" />
            </div>
          </div>
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
