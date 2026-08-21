"use client";

import { useEffect, useState } from "react";
import {
  WalletAccount, AccountType,
  ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS, ACCOUNT_TYPE_ON_COLORS,
  MOBILE_BANKING_PROVIDERS,
} from "@/lib/types";
import { api, errorMessage } from "@/lib/apiClient";
import { toMinor } from "@/lib/money";
import Modal from "@/components/ui/Modal";
import Money from "@/components/ui/Money";
import OptionCard from "@/components/ui/OptionCard";
import Stepper from "@/components/ui/wizard/Stepper";
import WizardPanel from "@/components/ui/wizard/WizardPanel";
import WizardFooter from "@/components/ui/wizard/WizardFooter";
import ReviewList from "@/components/ui/wizard/ReviewList";
import { useWizard, WizardStepDef } from "@/components/ui/wizard/useWizard";
import { useToast } from "@/components/ui/ToastProvider";
import { CashIcon, PhoneIcon, BankIcon, AlertIcon, CheckIcon } from "@/components/ui/icons";

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

const ACCOUNT_TYPE_COPY: Record<AccountType, string> = {
  cash:           "Notes and coins you are holding right now",
  mobile_banking: "bKash, Nagad, Rocket and the rest",
  bank_account:   "A current or savings account at a bank",
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
  const finalName = name.trim() || (accountType === "cash" ? "Cash" : resolvedProvider.trim());

  const steps: WizardStepDef[] = [
    {
      id: "type",
      label: "Type",
      description: "What kind of account is this? The rest of the form follows from your answer.",
    },
    {
      id: "details",
      label: "Details",
      description: "Name it something you will recognise in a list six months from now.",
      validate: () => {
        if (accountType === "mobile_banking" && provider === "Other" && !customProvider.trim()) {
          return "Enter the provider's name.";
        }
        return finalName ? null : "An account name is required.";
      },
    },
    {
      id: "balance",
      label: "Balance",
      description: "How much is in it today? Every transaction you add later moves from this figure.",
      validate: () =>
        initialBalance !== "" && toMinor(initialBalance) === null
          ? "That balance is not a valid amount."
          : null,
    },
    {
      id: "review",
      label: "Review",
      description: "Check the details before the account joins your wallet.",
    },
  ];

  const wizard = useWizard(steps);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!wizard.isLast) { wizard.next(); return; }

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
      <Stepper wizard={wizard} compact />

      <form onSubmit={handleSubmit} className="mt-5" noValidate>
        <WizardPanel wizard={wizard}>
          {wizard.current.id === "type" && (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Account type">
              {ACCOUNT_TYPES.map((type) => (
                <OptionCard
                  key={type}
                  selected={accountType === type}
                  onSelect={() => setAccountType(type)}
                  title={ACCOUNT_TYPE_LABELS[type]}
                  copy={ACCOUNT_TYPE_COPY[type]}
                  icon={ACCOUNT_ICONS[type]}
                  color={ACCOUNT_TYPE_COLORS[type]}
                  onColor={ACCOUNT_TYPE_ON_COLORS[type]}
                />
              ))}
            </div>
          )}

          {wizard.current.id === "details" && (
            <div className="flex flex-col gap-4">
              {accountType === "mobile_banking" && (
                <div>
                  <span className="field-label">Provider</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MOBILE_BANKING_PROVIDERS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProvider(p)}
                        className="chip"
                        data-active={provider === p}
                        style={provider === p ? undefined : { background: "var(--bg-sunken)" }}
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
                      aria-label="Custom provider name"
                      className="input-dark mt-2 animate-fade-in"
                    />
                  )}
                </div>
              )}

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

              {accountType !== "cash" && (
                <div>
                  <label htmlFor="account-number" className="field-label">
                    Account number <span className="font-normal text-ink-muted">(optional)</span>
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
                  <span className="field-hint">
                    Only stored so you can tell two accounts apart — the last four digits are enough.
                  </span>
                </div>
              )}
            </div>
          )}

          {wizard.current.id === "balance" && (
            <div>
              <label htmlFor="account-balance" className="field-label">
                Current balance <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold pointer-events-none text-ink-muted">
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
                  className="input-dark pl-8 !h-12 text-lg font-semibold"
                  autoFocus
                />
              </div>
              <span className="field-hint">
                Leave blank to start at zero. You can correct it any time from the account.
              </span>
            </div>
          )}

          {wizard.current.id === "review" && (
            <ReviewList
              onEdit={wizard.goTo}
              items={[
                { key: "type", label: "Type", value: ACCOUNT_TYPE_LABELS[accountType], stepIndex: 0 },
                ...(accountType === "mobile_banking"
                  ? [{ key: "provider", label: "Provider", value: resolvedProvider, stepIndex: 1 }]
                  : []),
                { key: "name", label: "Name", value: finalName, stepIndex: 1 },
                ...(accountType !== "cash"
                  ? [{
                      key: "number",
                      label: "Account number",
                      value: accountNumber.trim(),
                      empty: !accountNumber.trim(),
                      stepIndex: 1,
                    }]
                  : []),
                {
                  key: "balance",
                  label: "Opening balance",
                  value: <Money minor={toMinor(initialBalance) ?? 0} size="sm" tone="neutral" />,
                  stepIndex: 2,
                },
              ]}
            />
          )}
        </WizardPanel>

        {(wizard.error || error) && (
          <p className="alert-error mt-4 animate-fade-in" role="alert">
            <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {wizard.error || error}
          </p>
        )}

        <WizardFooter
          wizard={wizard}
          submitLabel="Add account"
          submitIcon={<CheckIcon className="w-4 h-4" />}
          busy={loading}
          onCancel={onClose}
        />
      </form>
    </Modal>
  );
}
