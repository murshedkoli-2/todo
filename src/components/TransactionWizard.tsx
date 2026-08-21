"use client";

import { useState } from "react";
import { toMinor } from "@/lib/money";
import Money from "@/components/ui/Money";
import OptionCard from "@/components/ui/OptionCard";
import Stepper from "@/components/ui/wizard/Stepper";
import WizardPanel from "@/components/ui/wizard/WizardPanel";
import { useWizard, WizardStepDef } from "@/components/ui/wizard/useWizard";
import {
  AlertIcon, PlusIcon, SpinnerIcon, ChevronLeftIcon, ChevronRightIcon,
} from "@/components/ui/icons";

export interface DirectionChoice<T extends string> {
  value: T;
  label: string;
  /** One line saying what this direction does to the balance. */
  copy: string;
  color: string;
  /** Partner `--on-*` token for `color`; see the note in `OptionCard`. */
  onColor: string;
  icon: React.ReactNode;
  /** `1` adds to the balance, `-1` subtracts — drives the live preview. */
  sign: 1 | -1;
}

export interface TransactionDraft<T extends string> {
  type: T;
  amount: string;
  note: string;
  date: string;
}

interface TransactionWizardProps<T extends string> {
  directions: ReadonlyArray<DirectionChoice<T>>;
  /** Resolves once the entry is persisted; rejects to keep the form open. */
  onSubmit: (draft: TransactionDraft<T>) => Promise<void>;
  directionLabel: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Add-a-transaction flow, shared by the ledger person and wallet account
 * modals.
 *
 * The two were near-identical copies of the same four controls, and had already
 * drifted apart in their labels. One component with a `directions` prop keeps
 * "receivable / payable" and "money in / money out" as data rather than as two
 * implementations to maintain in step.
 *
 * Two steps rather than four: the amount is the decision, and the date and note
 * are bookkeeping. Splitting on that line means the common case — an amount
 * today with no note — is amount, Continue, Add, and the running total is
 * previewed before it is committed.
 */
export default function TransactionWizard<T extends string>({
  directions, onSubmit, directionLabel,
}: TransactionWizardProps<T>) {
  const [type, setType] = useState<T>(directions[0].value);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const steps: WizardStepDef[] = [
    {
      id: "amount",
      label: "Amount",
      validate: () => {
        const minor = toMinor(amount);
        if (minor === null) return "Enter an amount.";
        if (minor <= 0) return "Enter an amount greater than zero.";
        return null;
      },
    },
    { id: "details", label: "Details" },
  ];

  const wizard = useWizard(steps);
  const active = directions.find((d) => d.value === type) ?? directions[0];
  const signedMinor = (toMinor(amount) ?? 0) * active.sign;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!wizard.isLast) { wizard.next(); return; }

    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ type, amount, note: note.trim(), date });
      // Reset to a clean first step: this form is used repeatedly in one
      // sitting, and leaving the previous amount in place is how a duplicate
      // entry gets created.
      setAmount("");
      setNote("");
      setDate(today());
      wizard.goTo(0);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not save that transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <Stepper wizard={wizard} compact />

      <WizardPanel wizard={wizard}>
        {wizard.current.id === "amount" ? (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2" role="radiogroup" aria-label={directionLabel}>
              {directions.map((direction) => (
                <OptionCard
                  key={direction.value}
                  selected={type === direction.value}
                  onSelect={() => setType(direction.value)}
                  title={direction.label}
                  copy={direction.copy}
                  icon={direction.icon}
                  color={direction.color}
                  onColor={direction.onColor}
                />
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-semibold pointer-events-none text-ink-muted">
                ৳
              </span>
              <input
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                aria-label="Amount"
                min="0.01"
                step="0.01"
                className="input-dark pl-9 !h-12 text-lg font-semibold"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="well px-3.5 py-2.5 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-ink-muted">{active.label}</span>
              <Money minor={signedMinor} size="md" signed />
            </div>

            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Transaction date"
              className="input-dark"
            />
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Note (optional)"
              aria-label="Note"
              maxLength={200}
              className="input-dark"
            />
          </div>
        )}
      </WizardPanel>

      {(wizard.error || error) && (
        <p className="alert-error animate-fade-in" role="alert">
          <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {wizard.error || error}
        </p>
      )}

      <div className="flex items-center gap-2">
        {!wizard.isFirst && (
          <button type="button" onClick={wizard.back} disabled={submitting} className="btn-outline">
            <ChevronLeftIcon className="w-4 h-4" />
            Back
          </button>
        )}
        <button type="submit" disabled={submitting} className="btn-primary flex-1">
          {submitting ? <SpinnerIcon className="w-4 h-4" /> : wizard.isLast && <PlusIcon className="w-4 h-4" />}
          <span>{submitting ? "Adding…" : wizard.isLast ? "Add transaction" : "Continue"}</span>
          {!wizard.isLast && <ChevronRightIcon className="w-4 h-4" />}
        </button>
      </div>
    </form>
  );
}
