"use client";

import { useMemo, useState } from "react";
import {
  WalletAccount, AccountType, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS,
} from "@/lib/types";
import AppShell from "@/components/shell/AppShell";
import AddAccountModal from "@/components/AddAccountModal";
import AccountDetailModal from "@/components/AccountDetailModal";
import PageToolbar from "@/components/ui/PageToolbar";
import EmptyState from "@/components/ui/EmptyState";
import Money from "@/components/ui/Money";
import ProgressBar from "@/components/ui/ProgressBar";
import {
  WalletIcon, CashIcon, PhoneIcon, BankIcon, PlusIcon, ChevronRightIcon,
} from "@/components/ui/icons";

interface WalletClientProps {
  initialWallets: WalletAccount[];
}

const ACCOUNT_ORDER: AccountType[] = ["cash", "mobile_banking", "bank_account"];

export const ACCOUNT_ICONS: Record<AccountType, React.ReactNode> = {
  cash: <CashIcon className="w-4 h-4" />,
  mobile_banking: <PhoneIcon className="w-4 h-4" />,
  bank_account: <BankIcon className="w-4 h-4" />,
};

/**
 * Balances across cash, mobile banking, and bank accounts.
 *
 * One hero total, then a statement grouped by account type. The previous card
 * grid gave a ৳50 cash float the same visual weight as a bank account.
 */
export default function WalletClient({ initialWallets }: WalletClientProps) {
  const [wallets, setWallets] = useState<WalletAccount[]>(initialWallets);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletAccount | null>(null);
  const [search, setSearch] = useState("");

  const totals = useMemo(() => {
    const sumOf = (type: AccountType) =>
      wallets
        .filter((wallet) => wallet.accountType === type)
        .reduce((sum, wallet) => sum + wallet.balanceMinor, 0);

    return {
      all: wallets.reduce((sum, wallet) => sum + wallet.balanceMinor, 0),
      cash: sumOf("cash"),
      mobile_banking: sumOf("mobile_banking"),
      bank_account: sumOf("bank_account"),
    };
  }, [wallets]);

  const visibleWallets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return wallets;
    return wallets.filter(
      (wallet) =>
        wallet.name.toLowerCase().includes(query) ||
        (wallet.provider?.toLowerCase().includes(query) ?? false) ||
        (wallet.accountNumber?.toLowerCase().includes(query) ?? false)
    );
  }, [wallets, search]);

  const handleAdd = (account: WalletAccount) =>
    setWallets((current) => [...current, account]);

  const handleUpdate = (updated: WalletAccount) => {
    setWallets((current) => current.map((w) => (w._id === updated._id ? updated : w)));
    setSelectedWallet((current) => (current?._id === updated._id ? updated : current));
  };

  const handleDelete = (id: string) => {
    setWallets((current) => current.filter((wallet) => wallet._id !== id));
    setSelectedWallet(null);
  };

  const countOf = (type: AccountType) =>
    wallets.filter((wallet) => wallet.accountType === type).length;

  return (
    <AppShell workspace="Balances">
      <PageToolbar
        title="Wallet"
        count={wallets.length}
        searchValue={search}
        searchPlaceholder="Search accounts…"
        onSearchChange={setSearch}
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="btn-secondary flex-shrink-0"
            id="add-account-btn"
          >
            <PlusIcon className="w-4 h-4" />
            Add account
          </button>
        }
      />

      {wallets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-7">
          <section className="panel-hero lg:col-span-1 p-5 sm:p-6 flex flex-col justify-center">
            <p className="text-eyebrow mb-2">Total balance</p>
            <Money minor={totals.all} size="hero" tone="neutral" />
            <p className="text-sm mt-2 text-ink-secondary">
              Across {wallets.length} account{wallets.length === 1 ? "" : "s"}
            </p>
          </section>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {ACCOUNT_ORDER.map((type) => {
              const color = ACCOUNT_TYPE_COLORS[type];
              const share = totals.all > 0 ? (totals[type] / totals.all) * 100 : 0;

              return (
                <article key={type} className="card p-4 sm:p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-7 h-7 rounded-well flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `color-mix(in srgb, ${color} 14%, transparent)`,
                        color,
                      }}
                    >
                      {ACCOUNT_ICONS[type]}
                    </span>
                    <p className="text-eyebrow truncate">{ACCOUNT_TYPE_LABELS[type]}</p>
                  </div>

                  <Money minor={totals[type]} size="md" tone="neutral" />

                  <div className="flex-1 min-h-[10px]" />

                  <div className="flex items-center gap-2 mt-3">
                    <ProgressBar
                      value={share}
                      color={color}
                      label={`${ACCOUNT_TYPE_LABELS[type]} share of total`}
                    />
                    <span className="text-[11px] font-semibold tabular-nums flex-shrink-0 text-ink-muted">
                      {countOf(type)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {visibleWallets.length === 0 ? (
        <EmptyState
          icon={<WalletIcon className="w-9 h-9" />}
          title={wallets.length === 0 ? "No accounts yet" : "Nothing matches that"}
          description={
            wallets.length === 0
              ? "Add your cash, mobile banking, or bank accounts to see your total balance."
              : "Try a different search term."
          }
          action={
            wallets.length === 0 ? (
              <button onClick={() => setShowAdd(true)} className="btn-primary px-6">
                <PlusIcon className="w-4 h-4" />
                Add first account
              </button>
            ) : (
              <button onClick={() => setSearch("")} className="btn-outline">
                Clear search
              </button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {ACCOUNT_ORDER.map((type) => {
            const group = visibleWallets.filter((wallet) => wallet.accountType === type);
            if (group.length === 0) return null;

            const color = ACCOUNT_TYPE_COLORS[type];
            const groupTotal = group.reduce((sum, wallet) => sum + wallet.balanceMinor, 0);

            return (
              <section key={type}>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-section">{ACCOUNT_TYPE_LABELS[type]}</h2>
                  <span className="text-xs font-medium text-ink-muted">{group.length}</span>
                  <div className="flex-1 h-px bg-line" />
                  <Money minor={groupTotal} size="sm" tone="neutral" />
                </div>

                <div className="statement">
                  {group.map((wallet) => (
                    <button
                      key={wallet._id}
                      onClick={() => setSelectedWallet(wallet)}
                      className="statement-row group"
                    >
                      <span
                        className="w-9 h-9 rounded-well flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `color-mix(in srgb, ${color} 14%, transparent)`,
                          color,
                        }}
                      >
                        {ACCOUNT_ICONS[wallet.accountType]}
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-sm truncate text-ink">
                          {wallet.name}
                        </span>
                        <span className="block text-xs truncate text-ink-muted">
                          {wallet.provider ?? ACCOUNT_TYPE_LABELS[wallet.accountType]}
                          {wallet.accountNumber ? ` · ${wallet.accountNumber}` : ""}
                        </span>
                      </span>

                      <span className="hidden sm:block w-24 text-right text-xs text-ink-muted">
                        {wallet.txCount} tx
                      </span>

                      <span className="w-32 text-right">
                        <Money minor={wallet.balanceMinor} size="md" tone="neutral" />
                      </span>

                      <ChevronRightIcon className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 text-ink-muted" />
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {selectedWallet && (
        <AccountDetailModal
          account={selectedWallet}
          onClose={() => setSelectedWallet(null)}
          onAccountUpdate={handleUpdate}
          onAccountDelete={handleDelete}
        />
      )}
    </AppShell>
  );
}
