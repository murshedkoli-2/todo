"use client";

import { useEffect, useRef, useState } from "react";
import { LedgerPersonWithBalance, EntryType } from "@/lib/types";
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
import {
  UsersIcon, ArrowUpIcon, ArrowDownIcon, AlertIcon, CheckIcon,
} from "@/components/ui/icons";

interface AddPersonModalProps {
  onClose: () => void;
  onAdd: (person: LedgerPersonWithBalance) => void;
}

export default function AddPersonModal({ onClose, onAdd }: AddPersonModalProps) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [initialType, setInitialType] = useState<EntryType>("receivable");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  /*
   * The opening balance step reads `initialAmount` through the same `toMinor`
   * the schema uses, so the figure previewed on the review screen is the one
   * the server will store. A preview derived a second way eventually disagrees
   * with the row it produced.
   */
  const openingMinor = toMinor(initialAmount) ?? 0;
  const signedOpening = initialType === "receivable" ? openingMinor : -openingMinor;

  const steps: WizardStepDef[] = [
    {
      id: "who",
      label: "Person",
      description: "Who are you tracking money with?",
      validate: () => (name.trim() ? null : "A name is required."),
    },
    {
      id: "opening",
      label: "Opening",
      description: "If there is already money between you, start the ledger from it. Skip this if you are starting from zero.",
      validate: () =>
        initialAmount !== "" && toMinor(initialAmount) === null
          ? "That opening balance is not a valid amount."
          : null,
    },
    {
      id: "review",
      label: "Review",
      description: "Check the details before adding them to your ledger.",
    },
  ];

  const wizard = useWizard(steps);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // The footer's forward control is only a submit button on the last step,
    // but Enter inside a field still fires the form — so advance instead.
    if (!wizard.isLast) { wizard.next(); return; }

    setLoading(true);
    setError("");
    try {
      const person = await api<LedgerPersonWithBalance>("/api/ledger", {
        method: "POST",
        body: {
          name: name.trim(),
          note: note.trim() || undefined,
          // Sent as typed; the schema converts to minor units server-side.
          initialAmount: initialAmount || undefined,
          initialType,
        },
      });
      onAdd(person);
      onClose();
      toast.success(`${person.name} added.`);
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add person"
      subtitle="Track what you owe and what you are owed"
      icon={<UsersIcon className="w-5 h-5" />}
      onClose={onClose}
    >
      <Stepper wizard={wizard} compact />

      <form onSubmit={handleSubmit} className="mt-5" noValidate>
        <WizardPanel wizard={wizard}>
          {wizard.current.id === "who" && (
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="person-name" className="field-label">
                  Name <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  ref={nameRef}
                  id="person-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahim, Karim, shop name…"
                  className="input-dark"
                  maxLength={100}
                />
              </div>

              <div>
                <label htmlFor="person-note" className="field-label">
                  Note <span className="font-normal text-ink-muted">(optional)</span>
                </label>
                <input
                  id="person-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Phone, address, relation…"
                  className="input-dark"
                  maxLength={200}
                />
                <span className="field-hint">
                  Anything that helps you tell two people with the same name apart.
                </span>
              </div>
            </div>
          )}

          {wizard.current.id === "opening" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Opening balance direction">
                <OptionCard
                  selected={initialType === "receivable"}
                  onSelect={() => setInitialType("receivable")}
                  title="They owe me"
                  copy="Money you have lent or are waiting to be paid"
                  icon={<ArrowUpIcon className="w-4 h-4" />}
                  color="var(--green)"
                  onColor="var(--on-green)"
                />
                <OptionCard
                  selected={initialType === "payable"}
                  onSelect={() => setInitialType("payable")}
                  title="I owe them"
                  copy="Money you have borrowed or still have to pay"
                  icon={<ArrowDownIcon className="w-4 h-4" />}
                  color="var(--red)"
                  onColor="var(--on-red)"
                />
              </div>

              <div>
                <label htmlFor="person-opening" className="field-label">
                  Amount <span className="font-normal text-ink-muted">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold pointer-events-none text-ink-muted">
                    ৳
                  </span>
                  <input
                    id="person-opening"
                    type="number"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="input-dark pl-8"
                  />
                </div>
                <span className="field-hint">
                  Leave this blank to start at zero and add transactions later.
                </span>
              </div>
            </div>
          )}

          {wizard.current.id === "review" && (
            <ReviewList
              onEdit={wizard.goTo}
              items={[
                { key: "name", label: "Name", value: name.trim(), stepIndex: 0 },
                { key: "note", label: "Note", value: note.trim(), empty: !note.trim(), stepIndex: 0 },
                {
                  key: "opening",
                  label: "Opening balance",
                  value: <Money minor={signedOpening} size="sm" signed />,
                  empty: openingMinor === 0,
                  stepIndex: 1,
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
          submitLabel="Add person"
          submitIcon={<CheckIcon className="w-4 h-4" />}
          busy={loading}
          onCancel={onClose}
        />
      </form>
    </Modal>
  );
}
