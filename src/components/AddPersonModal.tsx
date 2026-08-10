"use client";

import { useEffect, useRef, useState } from "react";
import { LedgerPersonWithBalance, EntryType } from "@/lib/types";
import { api, errorMessage } from "@/lib/apiClient";
import Modal from "@/components/ui/Modal";
import SegmentedToggle, { Segment } from "@/components/ui/SegmentedToggle";
import { useToast } from "@/components/ui/ToastProvider";
import {
  UsersIcon, ArrowUpIcon, ArrowDownIcon, AlertIcon, SpinnerIcon,
} from "@/components/ui/icons";

interface AddPersonModalProps {
  onClose: () => void;
  onAdd: (person: LedgerPersonWithBalance) => void;
}

const ENTRY_SEGMENTS: Segment<EntryType>[] = [
  { value: "receivable", label: "Receivable", color: "var(--green)", icon: <ArrowUpIcon className="w-3.5 h-3.5" /> },
  { value: "payable",    label: "Payable",    color: "var(--red)",   icon: <ArrowDownIcon className="w-3.5 h-3.5" /> },
];

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setError("A name is required."); return; }

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
    } finally {
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            Note <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
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
        </div>

        <div>
          <span className="field-label">
            Opening balance <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
          </span>
          <SegmentedToggle
            segments={ENTRY_SEGMENTS}
            value={initialType}
            onChange={setInitialType}
            ariaLabel="Opening balance direction"
          />
          <div className="relative mt-2">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            >
              ৳
            </span>
            <input
              type="number"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              aria-label="Opening balance amount"
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
            {loading ? "Adding…" : "Add person"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
