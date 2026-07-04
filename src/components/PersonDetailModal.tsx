"use client";

import { useState, useEffect, useCallback } from "react";
import { LedgerPersonWithBalance, LedgerEntry, EntryType } from "@/lib/types";

interface EntryWithBalance extends LedgerEntry {
  runningBalance: number;
}

interface PersonDetailModalProps {
  person: LedgerPersonWithBalance;
  onClose: () => void;
  onPersonUpdate: (updated: LedgerPersonWithBalance) => void;
  onPersonDelete: (id: string) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" });

export default function PersonDetailModal({ person, onClose, onPersonUpdate, onPersonDelete }: PersonDetailModalProps) {
  const [entries, setEntries] = useState<EntryWithBalance[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Add-entry form
  const [entryType, setEntryType] = useState<EntryType>("receivable");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [entryError, setEntryError] = useState("");

  // Delete confirm
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null);
  const [showDeletePerson, setShowDeletePerson] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const res = await fetch(`/api/ledger/${person._id}/entries`);
      if (!res.ok) throw new Error("Failed to load entries");
      const data = await res.json();
      setEntries(data);
    } catch { /* silent */ }
    finally { setLoadingEntries(false); }
  }, [person._id]);

  useEffect(() => {
    fetchEntries();
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fetchEntries, onClose]);

  // Compute current balance from entries
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : person.balance;
  const totalReceivable = entries.filter(e => e.type === "receivable").reduce((s, e) => s + e.amount, 0);
  const totalPayable = entries.filter(e => e.type === "payable").reduce((s, e) => s + e.amount, 0);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setEntryError("Enter a valid amount"); return; }
    setSubmitting(true);
    setEntryError("");
    try {
      const res = await fetch(`/api/ledger/${person._id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: entryType, amount: Number(amount), note: note.trim(), date: entryDate }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      await fetchEntries();
      // Update parent balance
      const newBalance = entryType === "receivable" ? currentBalance + Number(amount) : currentBalance - Number(amount);
      onPersonUpdate({
        ...person,
        balance: newBalance,
        totalReceivable: entryType === "receivable" ? totalReceivable + Number(amount) : totalReceivable,
        totalPayable: entryType === "payable" ? totalPayable + Number(amount) : totalPayable,
        lastEntryDate: new Date().toISOString(),
        entryCount: entries.length + 1,
      });
      setAmount("");
      setNote("");
      setEntryDate(new Date().toISOString().slice(0, 10));
    } catch (err: unknown) {
      setEntryError(err instanceof Error ? err.message : "Error");
    } finally { setSubmitting(false); }
  };

  const handleDeleteEntry = async (entryId: string) => {
    setDeletingEntry(entryId);
    try {
      const res = await fetch(`/api/ledger/${person._id}/entries/${entryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      await fetchEntries();
      // Recompute balance after reload
      const newEntries = entries.filter(en => en._id !== entryId);
      const newBalance = newEntries.reduce((s, en) => en.type === "receivable" ? s + en.amount : s - en.amount, 0);
      onPersonUpdate({
        ...person,
        balance: newBalance,
        totalReceivable: newEntries.filter(en => en.type === "receivable").reduce((s, en) => s + en.amount, 0),
        totalPayable: newEntries.filter(en => en.type === "payable").reduce((s, en) => s + en.amount, 0),
        lastEntryDate: newEntries.length > 0 ? newEntries[newEntries.length - 1].date : null,
        entryCount: newEntries.length,
      });
    } catch { /* silent */ }
    finally { setDeletingEntry(null); }
  };

  const handleDeletePerson = async () => {
    setDeletingPerson(true);
    try {
      const res = await fetch(`/api/ledger/${person._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      onPersonDelete(person._id);
      onClose();
    } catch { setDeletingPerson(false); }
  };

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
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-bold text-lg truncate" style={{ color: "var(--text-primary)" }}>{person.name}</h2>
            </div>
            {person.note && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{person.note}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button
              onClick={() => setShowDeletePerson(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-70"
              style={{ background: "rgba(248,81,73,0.1)", color: "#f85149" }}
              title="Delete person"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-70" style={{ background: "var(--hover-overlay)", color: "var(--text-muted)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Balance summary ── */}
        <div className="grid grid-cols-3 gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(63,185,80,0.08)", border: "1px solid rgba(63,185,80,0.18)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#3fb950" }}>Receivable</p>
            <p className="font-bold text-sm tabular-nums" style={{ color: "#3fb950" }}>৳{fmt(totalReceivable)}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.18)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#f85149" }}>Payable</p>
            <p className="font-bold text-sm tabular-nums" style={{ color: "#f85149" }}>৳{fmt(totalPayable)}</p>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{
              background: currentBalance >= 0 ? "rgba(63,185,80,0.12)" : "rgba(248,81,73,0.12)",
              border: `1px solid ${currentBalance >= 0 ? "rgba(63,185,80,0.25)" : "rgba(248,81,73,0.25)"}`,
            }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: currentBalance >= 0 ? "#3fb950" : "#f85149" }}>
              Net Balance
            </p>
            <p className="font-bold text-sm tabular-nums" style={{ color: currentBalance >= 0 ? "#3fb950" : "#f85149" }}>
              {currentBalance >= 0 ? "+" : "-"}৳{fmt(currentBalance)}
            </p>
          </div>
        </div>

        {/* ── Add Entry Form ── */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Add Transaction</p>
          <form onSubmit={handleAddEntry} className="space-y-3">
            {/* Type toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => setEntryType("receivable")}
                className="flex-1 py-2 text-xs font-semibold transition-all"
                style={{
                  background: entryType === "receivable" ? "rgba(63,185,80,0.15)" : "transparent",
                  color: entryType === "receivable" ? "#3fb950" : "var(--text-secondary)",
                  borderRight: "1px solid var(--border)",
                }}
              >
                ↑ Receivable (they owe you)
              </button>
              <button
                type="button"
                onClick={() => setEntryType("payable")}
                className="flex-1 py-2 text-xs font-semibold transition-all"
                style={{
                  background: entryType === "payable" ? "rgba(248,81,73,0.15)" : "transparent",
                  color: entryType === "payable" ? "#f85149" : "var(--text-secondary)",
                }}
              >
                ↓ Payable (you owe them)
              </button>
            </div>

            <div className="flex gap-2">
              {/* Amount */}
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>৳</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  min="0.01"
                  step="0.01"
                  className="input-dark w-full h-9 pl-7 pr-3 text-sm rounded-lg"
                />
              </div>
              {/* Date */}
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="input-dark h-9 px-3 text-sm rounded-lg"
                style={{ width: "140px" }}
              />
            </div>
            {/* Note */}
            <div className="flex gap-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="input-dark flex-1 h-9 px-3 text-sm rounded-lg"
                maxLength={200}
              />
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary h-9 px-4 text-sm rounded-xl font-semibold flex-shrink-0"
              >
                {submitting ? "…" : "Add"}
              </button>
            </div>
            {entryError && (
              <p className="text-xs" style={{ color: "#f85149" }}>{entryError}</p>
            )}
          </form>
        </div>

        {/* ── Transaction history ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
            History ({entries.length})
          </p>
          {loadingEntries ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No transactions yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Add your first entry above</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {[...entries].reverse().map((entry, i) => (
                <div
                  key={entry._id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 group transition-colors"
                  style={{ background: i % 2 === 0 ? "var(--hover-overlay)" : "transparent" }}
                >
                  {/* Type badge */}
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{
                      background: entry.type === "receivable" ? "rgba(63,185,80,0.15)" : "rgba(248,81,73,0.15)",
                      color: entry.type === "receivable" ? "#3fb950" : "#f85149",
                    }}
                  >
                    {entry.type === "receivable" ? "+" : "−"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm tabular-nums" style={{ color: entry.type === "receivable" ? "#3fb950" : "#f85149" }}>
                        {entry.type === "receivable" ? "+" : "−"}৳{fmt(entry.amount)}
                      </span>
                      {entry.note && (
                        <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{entry.note}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(entry.date)}</span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
                      <span className="text-xs font-medium tabular-nums" style={{ color: entry.runningBalance >= 0 ? "#3fb950" : "#f85149" }}>
                        Balance: {entry.runningBalance >= 0 ? "+" : ""}৳{entry.runningBalance >= 0 ? fmt(entry.runningBalance) : fmt(entry.runningBalance)}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteEntry(entry._id)}
                    disabled={deletingEntry === entry._id}
                    className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:opacity-70"
                    style={{ background: "rgba(248,81,73,0.1)", color: "#f85149" }}
                  >
                    {deletingEntry === entry._id ? (
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

      {/* ── Delete Person Confirm ── */}
      {showDeletePerson && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }}>
            <h3 className="font-bold text-base mb-2" style={{ color: "var(--text-primary)" }}>Delete {person.name}?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              This will permanently delete this person and all {entries.length} transaction{entries.length !== 1 ? "s" : ""}. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeletePerson(false)} className="flex-1 h-9 rounded-xl text-sm font-medium" style={{ background: "var(--hover-overlay)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={handleDeletePerson} disabled={deletingPerson} className="flex-1 h-9 rounded-xl text-sm font-semibold" style={{ background: "rgba(248,81,73,0.15)", color: "#f85149", border: "1px solid rgba(248,81,73,0.3)" }}>
                {deletingPerson ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
