"use client";

import { useState, useEffect, useCallback } from "react";
import { WalletAccount, WalletTransaction, TxType, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS } from "@/lib/types";

interface AccountDetailModalProps {
  account: WalletAccount;
  onClose: () => void;
  onAccountUpdate: (updated: WalletAccount) => void;
  onAccountDelete: (id: string) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" });

export default function AccountDetailModal({ account, onClose, onAccountUpdate, onAccountDelete }: AccountDetailModalProps) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [currentBalance, setCurrentBalance] = useState(account.balance);

  // Add tx form
  const [txType, setTxType] = useState<TxType>("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [txError, setTxError] = useState("");

  // Delete
  const [deletingTx, setDeletingTx] = useState<string | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const accentColor = account.color || ACCOUNT_TYPE_COLORS[account.accountType];

  const fetchTxs = useCallback(async () => {
    setLoadingTxs(true);
    try {
      const res = await fetch(`/api/wallet/${account._id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTransactions(data.transactions);
      setCurrentBalance(data.wallet.balance);
    } catch { /* silent */ }
    finally { setLoadingTxs(false); }
  }, [account._id]);

  useEffect(() => {
    fetchTxs();
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fetchTxs, onClose]);

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setTxError("Enter a valid amount"); return; }
    setSubmitting(true); setTxError("");
    try {
      const res = await fetch(`/api/wallet/${account._id}/tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: txType, amount: Number(amount), note: note.trim(), date: txDate }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      const data = await res.json();
      setCurrentBalance(data.newWalletBalance);
      onAccountUpdate({ ...account, balance: data.newWalletBalance, txCount: account.txCount + 1 });
      await fetchTxs();
      setAmount(""); setNote(""); setTxDate(new Date().toISOString().slice(0, 10));
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : "Error");
    } finally { setSubmitting(false); }
  };

  const handleDeleteTx = async (txId: string) => {
    setDeletingTx(txId);
    try {
      const res = await fetch(`/api/wallet/${account._id}/tx/${txId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCurrentBalance(data.newBalance);
      onAccountUpdate({ ...account, balance: data.newBalance, txCount: Math.max(0, account.txCount - 1) });
      await fetchTxs();
    } catch { /* silent */ }
    finally { setDeletingTx(null); }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await fetch(`/api/wallet/${account._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onAccountDelete(account._id);
      onClose();
    } catch { setDeletingAccount(false); }
  };

  const totalCredit = transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalDebit  = transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "var(--overlay-bg)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-xl max-h-[95vh] sm:max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl animate-scale-in overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accentColor}20`, color: accentColor }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {account.accountType === "cash" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                ) : account.accountType === "mobile_banking" ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                )}
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base truncate" style={{ color: "var(--text-primary)" }}>{account.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium" style={{ background: `${accentColor}18`, color: accentColor }}>
                  {ACCOUNT_TYPE_LABELS[account.accountType]}
                </span>
              </div>
              {account.accountNumber && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {account.accountType === "mobile_banking" ? "📱 " : "🏦 "}{account.accountNumber}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button onClick={() => setShowDeleteAccount(true)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: "rgba(248,81,73,0.1)", color: "#f85149" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: "var(--hover-overlay)", color: "var(--text-muted)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Balance summary ── */}
        <div className="grid grid-cols-3 gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(63,185,80,0.08)", border: "1px solid rgba(63,185,80,0.18)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#3fb950" }}>Money In</p>
            <p className="font-bold text-sm tabular-nums" style={{ color: "#3fb950" }}>৳{fmt(totalCredit)}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.18)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#f85149" }}>Money Out</p>
            <p className="font-bold text-sm tabular-nums" style={{ color: "#f85149" }}>৳{fmt(totalDebit)}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}30` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: accentColor }}>Balance</p>
            <p className="font-bold text-sm tabular-nums" style={{ color: accentColor }}>৳{fmt(currentBalance)}</p>
          </div>
        </div>

        {/* ── Add Tx form ── */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Add Transaction</p>
          <form onSubmit={handleAddTx} className="space-y-3">
            {/* Type toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button type="button" onClick={() => setTxType("credit")} className="flex-1 py-2 text-xs font-semibold transition-all"
                style={{ background: txType === "credit" ? "rgba(63,185,80,0.15)" : "transparent", color: txType === "credit" ? "#3fb950" : "var(--text-secondary)", borderRight: "1px solid var(--border)" }}>
                ↑ Money In (Credit)
              </button>
              <button type="button" onClick={() => setTxType("debit")} className="flex-1 py-2 text-xs font-semibold transition-all"
                style={{ background: txType === "debit" ? "rgba(248,81,73,0.15)" : "transparent", color: txType === "debit" ? "#f85149" : "var(--text-secondary)" }}>
                ↓ Money Out (Debit)
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>৳</span>
                <input
                  type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount" min="0.01" step="0.01"
                  className="input-dark w-full h-9 pl-7 pr-3 text-sm rounded-lg"
                />
              </div>
              <input
                type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)}
                className="input-dark h-9 px-3 text-sm rounded-lg w-full sm:w-36"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)" maxLength={200}
                className="input-dark flex-1 h-9 px-3 text-sm rounded-lg"
              />
              <button type="submit" disabled={submitting} className="btn-primary h-9 px-4 text-sm rounded-xl font-semibold flex-shrink-0">
                {submitting ? "…" : "Add"}
              </button>
            </div>
            {txError && <p className="text-xs" style={{ color: "#f85149" }}>{txError}</p>}
          </form>
        </div>

        {/* ── Transaction history ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
            History ({transactions.length})
          </p>
          {loadingTxs ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: accentColor, borderTopColor: "transparent" }} />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No transactions yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Add your first transaction above</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {transactions.map((tx, i) => (
                <div
                  key={tx._id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 group transition-colors"
                  style={{ background: i % 2 === 0 ? "var(--hover-overlay)" : "transparent" }}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: tx.type === "credit" ? "rgba(63,185,80,0.15)" : "rgba(248,81,73,0.15)", color: tx.type === "credit" ? "#3fb950" : "#f85149" }}>
                    {tx.type === "credit" ? "+" : "−"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm tabular-nums" style={{ color: tx.type === "credit" ? "#3fb950" : "#f85149" }}>
                        {tx.type === "credit" ? "+" : "−"}৳{fmt(tx.amount)}
                      </span>
                      {tx.note && <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{tx.note}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(tx.date)}</span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
                      <span className="text-xs font-medium tabular-nums" style={{ color: accentColor }}>
                        Balance: ৳{fmt(tx.balanceAfter)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTx(tx._id)}
                    disabled={deletingTx === tx._id}
                    className="w-6 h-6 rounded-lg flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all hover:opacity-70 flex-shrink-0"
                    style={{ background: "rgba(248,81,73,0.1)", color: "#f85149" }}
                  >
                    {deletingTx === tx._id ? (
                      <div className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: "#f85149", borderTopColor: "transparent" }} />
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteAccount && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }}>
            <h3 className="font-bold text-base mb-2" style={{ color: "var(--text-primary)" }}>Delete {account.name}?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              This will permanently delete this account and all {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}. Cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteAccount(false)} className="flex-1 h-9 rounded-xl text-sm font-medium" style={{ background: "var(--hover-overlay)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={handleDeleteAccount} disabled={deletingAccount} className="flex-1 h-9 rounded-xl text-sm font-semibold" style={{ background: "rgba(248,81,73,0.15)", color: "#f85149", border: "1px solid rgba(248,81,73,0.3)" }}>
                {deletingAccount ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
