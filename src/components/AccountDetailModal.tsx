"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  WalletAccount, WalletTransactionWithBalance, TxType,
  ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS,
} from "@/lib/types";
import { api, errorMessage } from "@/lib/apiClient";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SegmentedToggle, { Segment } from "@/components/ui/SegmentedToggle";
import Money from "@/components/ui/Money";
import Sparkline from "@/components/ui/Sparkline";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ArrowUpIcon, ArrowDownIcon, TrashIcon, SpinnerIcon, PlusIcon,
  CashIcon, PhoneIcon, BankIcon,
} from "@/components/ui/icons";

interface AccountDetailModalProps {
  account: WalletAccount;
  onClose: () => void;
  onAccountUpdate: (updated: WalletAccount) => void;
  onAccountDelete: (id: string) => void;
}

interface AccountResponse {
  wallet: WalletAccount;
  transactions: WalletTransactionWithBalance[];
}

const TX_SEGMENTS: Segment<TxType>[] = [
  { value: "credit", label: "Money in", color: "var(--green)", icon: <ArrowUpIcon className="w-3.5 h-3.5" /> },
  { value: "debit", label: "Money out", color: "var(--red)", icon: <ArrowDownIcon className="w-3.5 h-3.5" /> },
];

const ACCOUNT_ICONS = {
  cash: <CashIcon className="w-5 h-5" />,
  mobile_banking: <PhoneIcon className="w-5 h-5" />,
  bank_account: <BankIcon className="w-5 h-5" />,
} as const;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

const today = () => new Date().toISOString().slice(0, 10);

export default function AccountDetailModal({
  account, onClose, onAccountUpdate, onAccountDelete,
}: AccountDetailModalProps) {
  const toast = useToast();

  const [transactions, setTransactions] = useState<WalletTransactionWithBalance[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [balanceMinor, setBalanceMinor] = useState(account.balanceMinor);

  const [txType, setTxType] = useState<TxType>("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [txDate, setTxDate] = useState(today);
  const [submitting, setSubmitting] = useState(false);

  const [deletingTx, setDeletingTx] = useState<string | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const accentColor = ACCOUNT_TYPE_COLORS[account.accountType];

  const fetchTransactions = useCallback(async () => {
    setLoadingTxs(true);
    setLoadError("");
    try {
      const data = await api<AccountResponse>(`/api/wallet/${account._id}`);
      setTransactions(data.transactions);
      setBalanceMinor(data.wallet.balanceMinor);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoadingTxs(false);
    }
  }, [account._id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totals = useMemo(
    () => ({
      credit: transactions
        .filter((tx) => tx.type === "credit")
        .reduce((sum, tx) => sum + tx.amountMinor, 0),
      debit: transactions
        .filter((tx) => tx.type === "debit")
        .reduce((sum, tx) => sum + tx.amountMinor, 0),
    }),
    [transactions]
  );

  const balanceHistory = useMemo(
    () => transactions.map((tx) => tx.runningBalanceMinor),
    [transactions]
  );

  const handleAddTx = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await api<{ balanceMinor: number; txCount: number }>(
        `/api/wallet/${account._id}/tx`,
        {
          method: "POST",
          body: { type: txType, amount, note: note.trim(), date: txDate },
        }
      );

      onAccountUpdate({ ...account, balanceMinor: result.balanceMinor, txCount: result.txCount });
      await fetchTransactions();

      setAmount("");
      setNote("");
      setTxDate(today());
      toast.success("Transaction recorded.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTx = async (txId: string) => {
    setDeletingTx(txId);
    try {
      const result = await api<{ balanceMinor: number; txCount: number }>(
        `/api/wallet/${account._id}/tx/${txId}`,
        { method: "DELETE" }
      );

      onAccountUpdate({ ...account, balanceMinor: result.balanceMinor, txCount: result.txCount });
      await fetchTransactions();
      toast.success("Transaction removed.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeletingTx(null);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api(`/api/wallet/${account._id}`, { method: "DELETE" });
      onAccountDelete(account._id);
      onClose();
      toast.success(`${account.name} removed.`);
    } catch (error) {
      setDeletingAccount(false);
      setConfirmDeleteAccount(false);
      toast.error(errorMessage(error));
    }
  };

  const subtitle = [
    account.provider ?? ACCOUNT_TYPE_LABELS[account.accountType],
    account.accountNumber,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Modal
        title={account.name}
        subtitle={subtitle}
        icon={ACCOUNT_ICONS[account.accountType]}
        iconColor={accentColor}
        size="lg"
        scrollable
        onClose={onClose}
        headerActions={
          <button
            onClick={() => setConfirmDeleteAccount(true)}
            className="btn-ghost w-9 h-9 px-0 text-negative"
            aria-label={`Delete ${account.name}`}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        }
      >
        {/* ── Summary ── */}
        <div className="px-5 sm:px-6 py-4 flex-shrink-0 border-b border-line">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div className="min-w-0">
              <p className="text-eyebrow mb-1">Balance</p>
              <Money minor={balanceMinor} size="lg" tone="neutral" />
            </div>
            <Sparkline
              points={balanceHistory}
              color={accentColor}
              className="w-28 h-9 flex-shrink-0"
              label={`${account.name} balance history`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="well px-3 py-2.5">
              <p className="text-[11px] font-semibold text-ink-muted">Money in</p>
              <Money minor={totals.credit} size="sm" tone="positive" className="mt-0.5 block" />
            </div>
            <div className="well px-3 py-2.5">
              <p className="text-[11px] font-semibold text-ink-muted">Money out</p>
              <Money minor={totals.debit} size="sm" tone="negative" className="mt-0.5 block" />
            </div>
          </div>
        </div>

        {/* ── Add transaction ── */}
        <div className="px-5 sm:px-6 py-4 flex-shrink-0 border-b border-line">
          <p className="text-eyebrow mb-3">Add transaction</p>
          <form onSubmit={handleAddTx} className="flex flex-col gap-2.5">
            <SegmentedToggle
              segments={TX_SEGMENTS}
              value={txType}
              onChange={setTxType}
              ariaLabel="Transaction direction"
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold pointer-events-none text-ink-muted">
                  ৳
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Amount"
                  aria-label="Amount"
                  min="0.01"
                  step="0.01"
                  className="input-dark pl-8"
                />
              </div>
              <input
                type="date"
                value={txDate}
                onChange={(event) => setTxDate(event.target.value)}
                aria-label="Transaction date"
                className="input-dark sm:w-40"
              />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Note (optional)"
                aria-label="Note"
                maxLength={200}
                className="input-dark flex-1"
              />
              <button type="submit" disabled={submitting} className="btn-primary px-5 flex-shrink-0">
                {submitting ? <SpinnerIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
                Add
              </button>
            </div>
          </form>
        </div>

        {/* ── History ── */}
        <div className="flex-1 overflow-y-auto">
          <p className="text-eyebrow px-5 sm:px-6 pt-4 pb-2">
            History ({transactions.length})
          </p>

          {loadingTxs ? (
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
          ) : transactions.length === 0 ? (
            <p className="text-sm text-center py-10 text-ink-muted">
              No transactions yet — add the first one above.
            </p>
          ) : (
            <ul>
              {[...transactions].reverse().map((tx) => {
                const positive = tx.type === "credit";
                const tone = positive ? "var(--green)" : "var(--red)";

                return (
                  <li key={tx._id} className="statement-row group">
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
                        {tx.note ?? (positive ? "Money in" : "Money out")}
                      </span>
                      <span className="block text-xs text-ink-muted">{formatDate(tx.date)}</span>
                    </span>

                    <span className="text-right">
                      <Money
                        minor={positive ? tx.amountMinor : -tx.amountMinor}
                        size="sm"
                        signed
                        className="block"
                      />
                      <span className="block text-[11px] mt-0.5 text-ink-muted">
                        bal <Money minor={tx.runningBalanceMinor} size="sm" tone="inherit" />
                      </span>
                    </span>

                    <button
                      onClick={() => handleDeleteTx(tx._id)}
                      disabled={deletingTx === tx._id}
                      className="btn-ghost w-8 h-8 px-0 flex-shrink-0 text-negative sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Delete transaction from ${formatDate(tx.date)}`}
                    >
                      {deletingTx === tx._id ? (
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

      {confirmDeleteAccount && (
        <ConfirmDialog
          title={`Delete ${account.name}?`}
          message={`This removes the account and all ${transactions.length} transaction${
            transactions.length === 1 ? "" : "s"
          }. This cannot be undone.`}
          busy={deletingAccount}
          onConfirm={handleDeleteAccount}
          onCancel={() => setConfirmDeleteAccount(false)}
        />
      )}
    </>
  );
}
