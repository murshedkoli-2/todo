"use client";

import { useState } from "react";
import Link from "next/link";
import {
  WalletAccount, AccountType,
  ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS,
} from "@/lib/types";
import AddAccountModal from "@/components/AddAccountModal";
import AccountDetailModal from "@/components/AccountDetailModal";
import ThemeToggle from "@/components/ThemeToggle";
import AuthButton from "@/components/AuthButton";

interface WalletClientProps {
  initialWallets: WalletAccount[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const ACCOUNT_ICONS: Record<AccountType, React.ReactNode> = {
  cash: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  mobile_banking: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  bank_account: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  ),
};

export default function WalletClient({ initialWallets }: WalletClientProps) {
  const [wallets, setWallets] = useState<WalletAccount[]>(initialWallets);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletAccount | null>(null);

  const totalBalance  = wallets.reduce((s, w) => s + w.balance, 0);
  const cashTotal     = wallets.filter(w => w.accountType === "cash").reduce((s, w) => s + w.balance, 0);
  const mobileTotal   = wallets.filter(w => w.accountType === "mobile_banking").reduce((s, w) => s + w.balance, 0);
  const bankTotal     = wallets.filter(w => w.accountType === "bank_account").reduce((s, w) => s + w.balance, 0);

  const handleAdd = (account: WalletAccount) => setWallets(prev => [...prev, account]);
  const handleUpdate = (updated: WalletAccount) => {
    setWallets(prev => prev.map(w => w._id === updated._id ? updated : w));
    if (selectedWallet?._id === updated._id) setSelectedWallet(updated);
  };
  const handleDelete = (id: string) => {
    setWallets(prev => prev.filter(w => w._id !== id));
    setSelectedWallet(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: "var(--bg-primary)" }}>

      {/* ── Top Nav ── */}
      <header
        className="sticky top-0 z-40"
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(12px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-14">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <span className="font-semibold text-base tracking-tight" style={{ color: "var(--text-primary)" }}>TaskFlow</span>
            </div>

            {/* Tab switcher — Tasks | Ledger | Wallet */}
            <div className="flex items-center gap-1 rounded-lg p-0.5 flex-shrink-0" style={{ background: "var(--hover-overlay)" }}>
              <Link href="/" className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all hover:opacity-80" style={{ color: "var(--text-secondary)" }}>Tasks</Link>
              <Link href="/ledger" className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all hover:opacity-80" style={{ color: "var(--text-secondary)" }}>Ledger</Link>
              <span className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "var(--shadow-card)" }}>
                Wallet
              </span>
            </div>

            <div className="flex-1" />
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>My Balance</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Track your cash, mobile banking & bank accounts</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary self-start sm:self-auto" id="add-account-btn">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Account
          </button>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {/* Total */}
          <div className="col-span-2 sm:col-span-1 rounded-2xl p-4" style={{ background: "linear-gradient(135deg, rgba(68,147,248,0.15), rgba(188,140,255,0.15))", border: "1px solid rgba(68,147,248,0.25)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(68,147,248,0.2)" }}>
                <svg className="w-5 h-5" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xl font-bold tabular-nums" style={{ color: "var(--accent)" }}>৳{fmt(totalBalance)}</span>
            </div>
            <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--accent)" }}>Total Balance</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{wallets.length} account{wallets.length !== 1 ? "s" : ""}</p>
          </div>

          {/* Cash */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(227,179,65,0.08)", border: "1px solid rgba(227,179,65,0.18)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(227,179,65,0.15)" }}>
                <svg className="w-5 h-5" style={{ color: "#e3b341" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-xl font-bold tabular-nums" style={{ color: "#e3b341" }}>৳{fmt(cashTotal)}</span>
            </div>
            <p className="text-xs font-semibold tracking-wide" style={{ color: "#e3b341" }}>Cash</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{wallets.filter(w => w.accountType === "cash").length} account{wallets.filter(w => w.accountType === "cash").length !== 1 ? "s" : ""}</p>
          </div>

          {/* Mobile Banking */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(188,140,255,0.08)", border: "1px solid rgba(188,140,255,0.18)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(188,140,255,0.15)" }}>
                <svg className="w-5 h-5" style={{ color: "#bc8cff" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xl font-bold tabular-nums" style={{ color: "#bc8cff" }}>৳{fmt(mobileTotal)}</span>
            </div>
            <p className="text-xs font-semibold tracking-wide" style={{ color: "#bc8cff" }}>Mobile Banking</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{wallets.filter(w => w.accountType === "mobile_banking").length} account{wallets.filter(w => w.accountType === "mobile_banking").length !== 1 ? "s" : ""}</p>
          </div>

          {/* Bank */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(68,147,248,0.08)", border: "1px solid rgba(68,147,248,0.18)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(68,147,248,0.15)" }}>
                <svg className="w-5 h-5" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              </div>
              <span className="text-xl font-bold tabular-nums" style={{ color: "var(--accent)" }}>৳{fmt(bankTotal)}</span>
            </div>
            <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--accent)" }}>Bank Accounts</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{wallets.filter(w => w.accountType === "bank_account").length} account{wallets.filter(w => w.accountType === "bank_account").length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* ── Account cards ── */}
        {wallets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <svg className="w-9 h-9" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-2" style={{ color: "var(--text-primary)" }}>No accounts yet</h3>
            <p className="text-sm max-w-xs mb-6 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Add your cash, mobile banking, or bank accounts to track your total balance.
            </p>
            <button onClick={() => setShowAdd(true)} className="btn-primary px-6 py-2.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add first account
            </button>
          </div>
        ) : (
          <>
            {(["cash", "mobile_banking", "bank_account"] as AccountType[]).map((type) => {
              const group = wallets.filter(w => w.accountType === type);
              if (group.length === 0) return null;
              const color = ACCOUNT_TYPE_COLORS[type];
              return (
                <div key={type} className="mb-8">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
                      {ACCOUNT_ICONS[type]}
                    </div>
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{ACCOUNT_TYPE_LABELS[type]}</h2>
                    <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    <span className="text-xs font-medium tabular-nums" style={{ color }}>
                      ৳{fmt(group.reduce((s, w) => s + w.balance, 0))}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.map((wallet, i) => (
                      <button
                        key={wallet._id}
                        onClick={() => setSelectedWallet(wallet)}
                        className="text-left rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] animate-fade-in-up"
                        style={{ animationDelay: `${i * 40}ms`, background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
                      >
                        {/* Top row */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, color }}>
                            {ACCOUNT_ICONS[wallet.accountType]}
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}14`, color }}>
                            {wallet.provider || ACCOUNT_TYPE_LABELS[wallet.accountType]}
                          </span>
                        </div>

                        {/* Name */}
                        <p className="font-semibold text-sm mb-0.5 truncate" style={{ color: "var(--text-primary)" }}>{wallet.name}</p>
                        {wallet.accountNumber && (
                          <p className="text-xs mb-3 truncate" style={{ color: "var(--text-muted)" }}>{wallet.accountNumber}</p>
                        )}

                        {/* Balance */}
                        <div className="rounded-xl px-3 py-2.5 mb-3" style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
                          <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>Balance</p>
                          <p className="text-xl font-bold tabular-nums" style={{ color }}>৳{fmt(wallet.balance)}</p>
                        </div>

                        {/* Tx count */}
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {wallet.txCount} transaction{wallet.txCount !== 1 ? "s" : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {selectedWallet && (
        <AccountDetailModal
          account={selectedWallet}
          onClose={() => setSelectedWallet(null)}
          onAccountUpdate={handleUpdate}
          onAccountDelete={handleDelete}
        />
      )}
    </div>
  );
}
