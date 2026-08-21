"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  WalletAccount, WalletTransactionWithBalance, TxType,
  ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS,
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

const TX_DIRECTIONS: ReadonlyArray<DirectionChoice<TxType>> = [
  {
    value: "credit",
    label: "Money in",
    copy: "A deposit, payment received, or top-up",
    color: "var(--green)",
    onColor: "var(--on-green)",
    icon: <ArrowUpIcon className="w-4 h-4" />,
    sign: 1,
  },
  {
    value: "debit",
    label: "Money out",
    copy: "A withdrawal, purchase, or transfer out",
    color: "var(--red)",
    onColor: "var(--on-red)",
    icon: <ArrowDownIcon className="w-4 h-4" />,
    sign: -1,
  },
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


export default function AccountDetailModal({
  account, onClose, onAccountUpdate, onAccountDelete,
}: AccountDetailModalProps) {
  const toast = useToast();

  const [transactions, setTransactions] = useState<WalletTransactionWithBalance[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [balanceMinor, setBalanceMinor] = useState(account.balanceMinor);

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

  /*
   * Throws rather than swallowing: `TransactionWizard` keeps the entry on
   * screen and shows the message when the promise rejects, so a failed save
   * must not resolve.
   */
  const handleAddTx = async (draft: TransactionDraft<TxType>) => {
    const result = await api<{ balanceMinor: number; txCount: number }>(
      `/api/wallet/${account._id}/tx`,
      {
        method: "POST",
        body: { type: draft.type, amount: draft.amount, note: draft.note, date: draft.date },
      }
    );

    onAccountUpdate({ ...account, balanceMinor: result.balanceMinor, txCount: result.txCount });
    await fetchTransactions();
    toast.success("Transaction recorded.");
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
          <TransactionWizard
            directions={TX_DIRECTIONS}
            directionLabel="Transaction direction"
            onSubmit={handleAddTx}
          />
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
