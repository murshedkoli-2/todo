"use client";

import { useState, useRef, useEffect } from "react";
import {
  WalletAccount, AccountType,
  ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS, MOBILE_BANKING_PROVIDERS,
} from "@/lib/types";

interface AddAccountModalProps {
  onClose: () => void;
  onAdd: (account: WalletAccount) => void;
}

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

export default function AddAccountModal({ onClose, onAdd }: AddAccountModalProps) {
  const [accountType, setAccountType] = useState<AccountType>("cash");
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("bKash");
  const [customProvider, setCustomProvider] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-fill name based on type/provider
    if (accountType === "cash") setName("Cash");
    else if (accountType === "mobile_banking") setName(provider === "Other" ? customProvider : provider);
    else setName("");
    inputRef.current?.focus();
  }, [accountType, provider, customProvider]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || (accountType === "cash" ? "Cash" : provider);
    if (!finalName) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          accountType,
          provider: accountType !== "cash" ? (provider === "Other" ? customProvider : provider) : undefined,
          accountNumber: accountNumber.trim() || undefined,
          initialBalance: initialBalance ? Number(initialBalance) : 0,
          color: ACCOUNT_TYPE_COLORS[accountType],
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      const account = await res.json();
      onAdd(account);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--overlay-bg)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl animate-scale-in"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${ACCOUNT_TYPE_COLORS[accountType]}22`, color: ACCOUNT_TYPE_COLORS[accountType] }}>
              {ACCOUNT_ICONS[accountType]}
            </div>
            <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>Add Account</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-70" style={{ background: "var(--hover-overlay)", color: "var(--text-muted)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Account type selection */}
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "mobile_banking", "bank_account"] as AccountType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAccountType(t)}
                  className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all"
                  style={{
                    background: accountType === t ? `${ACCOUNT_TYPE_COLORS[t]}18` : "var(--hover-overlay)",
                    border: `1px solid ${accountType === t ? ACCOUNT_TYPE_COLORS[t] + "55" : "var(--border)"}`,
                    color: accountType === t ? ACCOUNT_TYPE_COLORS[t] : "var(--text-secondary)",
                  }}
                >
                  {ACCOUNT_ICONS[t]}
                  <span className="text-xs font-medium leading-tight text-center">{ACCOUNT_TYPE_LABELS[t]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Provider (mobile banking) */}
          {accountType === "mobile_banking" && (
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Provider</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {MOBILE_BANKING_PROVIDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: provider === p ? "rgba(188,140,255,0.18)" : "var(--hover-overlay)",
                      color: provider === p ? "#bc8cff" : "var(--text-secondary)",
                      border: `1px solid ${provider === p ? "#bc8cff55" : "var(--border)"}`,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {provider === "Other" && (
                <input
                  type="text"
                  value={customProvider}
                  onChange={(e) => setCustomProvider(e.target.value)}
                  placeholder="Provider name"
                  className="input-dark w-full h-9 px-3 text-sm rounded-lg"
                />
              )}
            </div>
          )}

          {/* Account name */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Account Name <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={accountType === "cash" ? "Cash" : accountType === "mobile_banking" ? "e.g. bKash Personal" : "e.g. Dutch-Bangla Savings"}
              className="input-dark w-full h-10 px-3 text-sm rounded-lg"
              maxLength={100}
            />
          </div>

          {/* Account number (bank / mobile banking) */}
          {accountType !== "cash" && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Account / Number <span className="font-normal normal-case" style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={accountType === "mobile_banking" ? "01XXXXXXXXX" : "Account number / last 4 digits"}
                className="input-dark w-full h-10 px-3 text-sm rounded-lg"
                maxLength={30}
              />
            </div>
          )}

          {/* Initial balance */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Current Balance <span className="font-normal normal-case" style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>৳</span>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="input-dark w-full h-10 pl-7 pr-3 text-sm rounded-lg"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(248,81,73,0.12)", color: "#f85149", border: "1px solid rgba(248,81,73,0.2)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl text-sm font-medium" style={{ background: "var(--hover-overlay)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 h-10 rounded-xl text-sm font-semibold btn-primary">
              {loading ? "Adding…" : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
