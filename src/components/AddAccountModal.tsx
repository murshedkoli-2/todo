"use client";

import { useEffect, useState } from "react";
import {
  WalletAccount, AccountType,
  ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS, MOBILE_BANKING_PROVIDERS,
} from "@/lib/types";
import { api, errorMessage } from "@/lib/apiClient";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { CashIcon, PhoneIcon, BankIcon, AlertIcon, SpinnerIcon } from "@/components/ui/icons";

interface AddAccountModalProps {
  onClose: () => void;
  onAdd: (account: WalletAccount) => void;
}

const ACCOUNT_TYPES: AccountType[] = ["cash", "mobile_banking", "bank_account"];

const ACCOUNT_ICONS: Record<AccountType, React.ReactNode> = {
  cash:           <CashIcon className="w-5 h-5" />,
  mobile_banking: <PhoneIcon className="w-5 h-5" />,
  bank_account:   <BankIcon className="w-5 h-5" />,
};

const NAME_PLACEHOLDERS: Record<AccountType, string> = {
  cash:           "Cash",
  mobile_banking: "e.g. bKash personal",
  bank_account:   "e.g. Dutch-Bangla savings",
};

export default function AddAccountModal({ onClose, onAdd }: AddAccountModalProps) {
  const toast = useToast();
  const [accountType, setAccountType] = useState<AccountType>("cash");
  const [name, setName] = useState("Cash");
  const [provider, setProvider] = useState("bKash");
  const [customProvider, setCustomProvider] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* Suggest a sensible default name whenever the type or provider changes. */
  useEffect(() => {
    if (accountType === "cash") setName("Cash");
    else if (accountType === "mobile_banking") setName(provider === "Other" ? customProvider : provider);
    else setName("");
  }, [accountType, provider, customProvider]);

  const resolvedProvider = provider === "Other" ? customProvider : provider;
  const accentColor = ACCOUNT_TYPE_COLORS[accountType];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const finalName = name.trim() || (accountType === "cash" ? "Cash" : resolvedProvider);
    if (!finalName) { setError("An account name is required."); return; }

    setLoading(true);
    setError("");
    try {
      const account = await api<WalletAccount>("/api/wallet", {
        method: "POST",
        body: {
          name: finalName,
          accountType,
          provider: accountType !== "cash" ? resolvedProvider || undefined : undefined,
          accountNumber: accountNumber.trim() || undefined,
          // Sent as typed; the schema converts to minor units server-side.
          initialBalance: initialBalance || 0,
        },
      });
      onAdd(account);
      onClose();
      toast.success(`${account.name} added.`);
    } catch (caught: unknown) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add account"
      subtitle="Cash, mobile banking, or a bank account"
      icon={ACCOUNT_ICONS[accountType]}
      iconColor={accentColor}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Type */}
        <div>
          <span className="field-label">Account type</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Account type">
            {ACCOUNT_TYPES.map((type) => {
              const active = accountType === type;
              const color = ACCOUNT_TYPE_COLORS[type];
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setAccountType(type)}
                  className="flex flex-col items-center gap-2 rounded-well py-3.5 px-2"
                  style={{
                    background: active
                      ? `color-mix(in srgb, ${color} 12%, transparent)`
                      : "var(--bg-sunken)",
                    border: `1px solid ${active ? color : "transparent"}`,
                    color: active ? color : "var(--text-secondary)",
                  }}
                >
                  {ACCOUNT_ICONS[type]}
                  <span className="text-[11px] font-bold leading-tight text-center">
                    {ACCOUNT_TYPE_LABELS[type]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Provider */}
        {accountType === "mobile_banking" && (
          <div>
            <span className="field-label">Provider</span>
            <div className="flex flex-wrap gap-1.5">
              {MOBILE_BANKING_PROVIDERS.map((p) => {
                const active = provider === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className="chip"
                    data-active={active}
                    style={active ? undefined : { background: "var(--bg-sunken)" }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            {provider === "Other" && (
              <input
                type="text"
                value={customProvider}
                onChange={(e) => setCustomProvider(e.target.value)}
                placeholder="Provider name"
                aria-label="Custom provider name"
                className="input-dark mt-2"
              />
            )}
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="account-name" className="field-label">
            Account name <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <input
            id="account-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={NAME_PLACEHOLDERS[accountType]}
            className="input-dark"
            maxLength={100}
          />
        </div>

        {/* Number */}
        {accountType !== "cash" && (
          <div>
            <label htmlFor="account-number" className="field-label">
              Account number <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <input
              id="account-number"
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={accountType === "mobile_banking" ? "01XXXXXXXXX" : "Account number or last 4 digits"}
              className="input-dark"
              maxLength={30}
            />
          </div>
        )}

        {/* Balance */}
        <div>
          <label htmlFor="account-balance" className="field-label">
            Current balance <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <div className="relative">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            >
              ৳
            </span>
            <input
              id="account-balance"
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="input-dark pl-8"
            />
          </div>
        </div>

        {error && (
          <p className="alert-error" role="alert">
            <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading && <SpinnerIcon className="w-4 h-4" />}
            {loading ? "Adding…" : "Add account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
