"use client";

import { useState, useRef, useEffect } from "react";
import { LedgerPersonWithBalance } from "@/lib/types";

interface AddPersonModalProps {
  onClose: () => void;
  onAdd: (person: LedgerPersonWithBalance) => void;
}

export default function AddPersonModal({ onClose, onAdd }: AddPersonModalProps) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [initialType, setInitialType] = useState<"receivable" | "payable">("receivable");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          note: note.trim(),
          initialAmount: initialAmount ? Number(initialAmount) : undefined,
          initialType,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create person");
      }
      const person = await res.json();
      onAdd(person);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--overlay-bg)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl animate-scale-in"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(68,147,248,0.15)" }}>
              <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>Add Person</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-70" style={{ background: "var(--hover-overlay)", color: "var(--text-muted)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Name <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahim, Karim, Shop Name..."
              className="input-dark w-full h-10 px-3 text-sm rounded-lg"
              maxLength={100}
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Note <span className="font-normal normal-case" style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Phone, address, relation..."
              className="input-dark w-full h-10 px-3 text-sm rounded-lg"
              maxLength={200}
            />
          </div>

          {/* Opening balance */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Opening Balance <span className="font-normal normal-case" style={{ color: "var(--text-muted)" }}>(optional)</span>
            </label>
            {/* Type toggle */}
            <div className="flex rounded-lg overflow-hidden mb-2" style={{ border: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => setInitialType("receivable")}
                className="flex-1 py-2 text-xs font-semibold transition-all"
                style={{
                  background: initialType === "receivable" ? "rgba(63,185,80,0.15)" : "transparent",
                  color: initialType === "receivable" ? "#3fb950" : "var(--text-secondary)",
                  borderRight: "1px solid var(--border)",
                }}
              >
                ↑ Receivable
              </button>
              <button
                type="button"
                onClick={() => setInitialType("payable")}
                className="flex-1 py-2 text-xs font-semibold transition-all"
                style={{
                  background: initialType === "payable" ? "rgba(248,81,73,0.15)" : "transparent",
                  color: initialType === "payable" ? "#f85149" : "var(--text-secondary)",
                }}
              >
                ↓ Payable
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>৳</span>
              <input
                type="number"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
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
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl text-sm font-medium transition-all"
              style={{ background: "var(--hover-overlay)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-xl text-sm font-semibold transition-all btn-primary"
            >
              {loading ? "Adding…" : "Add Person"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
