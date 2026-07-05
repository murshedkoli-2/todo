"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LedgerPersonWithBalance } from "@/lib/types";
import AddPersonModal from "@/components/AddPersonModal";
import PersonDetailModal from "@/components/PersonDetailModal";
import ThemeToggle from "@/components/ThemeToggle";
import AuthButton from "@/components/AuthButton";

interface LedgerClientProps {
  initialPersons: LedgerPersonWithBalance[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function LedgerClient({ initialPersons }: LedgerClientProps) {
  const [persons, setPersons] = useState<LedgerPersonWithBalance[]>(initialPersons);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<LedgerPersonWithBalance | null>(null);
  const [search, setSearch] = useState("");

  const totalReceivable = persons.reduce((s, p) => s + Math.max(0, p.balance), 0);
  const totalPayable    = persons.reduce((s, p) => s + Math.max(0, -p.balance), 0);
  const netBalance      = persons.reduce((s, p) => s + p.balance, 0);

  const filtered = persons.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.note?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (person: LedgerPersonWithBalance) => {
    setPersons((prev) => [person, ...prev]);
  };

  const handlePersonUpdate = (updated: LedgerPersonWithBalance) => {
    setPersons((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    if (selectedPerson?._id === updated._id) setSelectedPerson(updated);
  };

  const handlePersonDelete = (id: string) => {
    setPersons((prev) => prev.filter((p) => p._id !== id));
    setSelectedPerson(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: "var(--bg-primary)" }}>

      {/* ── Top Nav ── */}
      <header
        className="sticky top-0 z-40"
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4 h-14">
            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
                <Image src="/logo.png" alt="TaskFlow Logo" fill className="object-contain drop-shadow" />
              </div>
              <span className="font-semibold text-sm sm:text-base hidden sm:block tracking-tight" style={{ color: "var(--text-primary)" }}>
                TaskFlow
              </span>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-0.5 sm:gap-1 rounded-lg p-0.5" style={{ background: "var(--hover-overlay)" }}>
              <Link
                href="/"
                className="px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all hover:opacity-80"
                style={{ color: "var(--text-secondary)" }}
              >
                Tasks
              </Link>
              <span
                className="px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold"
                style={{ background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "var(--shadow-card)" }}
              >
                Ledger
              </span>
              <Link
                href="/wallet"
                className="px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all hover:opacity-80"
                style={{ color: "var(--text-secondary)" }}
              >
                Wallet
              </Link>
            </div>

            <div className="flex-1" />
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-1">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Receivable & Payable
            </h1>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Track money owed to/from people
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary flex-shrink-0"
            id="add-person-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden xs:inline sm:inline">Add Person</span>
            <span className="xs:hidden sm:hidden">Add</span>
          </button>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 sm:mb-8">
          {/* Receivable */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(63,185,80,0.08)", border: "1px solid rgba(63,185,80,0.18)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(63,185,80,0.15)" }}>
                <svg className="w-5 h-5" style={{ color: "#3fb950" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
              <span className="text-2xl font-bold tabular-nums" style={{ color: "#3fb950" }}>
                ৳{fmt(totalReceivable)}
              </span>
            </div>
            <p className="text-xs font-semibold tracking-wide" style={{ color: "#3fb950" }}>Total Receivable</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Others owe you this</p>
          </div>

          {/* Payable */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.18)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(248,81,73,0.15)" }}>
                <svg className="w-5 h-5" style={{ color: "#f85149" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
              <span className="text-2xl font-bold tabular-nums" style={{ color: "#f85149" }}>
                ৳{fmt(totalPayable)}
              </span>
            </div>
            <p className="text-xs font-semibold tracking-wide" style={{ color: "#f85149" }}>Total Payable</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>You owe others this</p>
          </div>

          {/* Net */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: netBalance >= 0 ? "rgba(68,147,248,0.08)" : "rgba(227,179,65,0.08)",
              border: `1px solid ${netBalance >= 0 ? "rgba(68,147,248,0.18)" : "rgba(227,179,65,0.18)"}`,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: netBalance >= 0 ? "rgba(68,147,248,0.15)" : "rgba(227,179,65,0.15)" }}>
                <svg className="w-5 h-5" style={{ color: netBalance >= 0 ? "var(--accent)" : "#e3b341" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <span className="text-2xl font-bold tabular-nums" style={{ color: netBalance >= 0 ? "var(--accent)" : "#e3b341" }}>
                {netBalance >= 0 ? "+" : "-"}৳{fmt(netBalance)}
              </span>
            </div>
            <p className="text-xs font-semibold tracking-wide" style={{ color: netBalance >= 0 ? "var(--accent)" : "#e3b341" }}>
              Net Balance
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {netBalance >= 0 ? "Overall you are owed" : "Overall you owe"}
            </p>
          </div>
        </div>

        {/* ── Search ── */}
        {persons.length > 0 && (
          <div className="relative mb-5 max-w-full sm:max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-dark pl-9 h-9 text-sm w-full rounded-lg"
            />
          </div>
        )}

        {/* ── Person grid ── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
            >
              <svg className="w-9 h-9" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-2" style={{ color: "var(--text-primary)" }}>
              {persons.length === 0 ? "No people yet" : "No matching people"}
            </h3>
            <p className="text-sm max-w-xs mb-6 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {persons.length === 0
                ? "Add a person to start tracking receivables and payables."
                : "Try a different search."}
            </p>
            {persons.length === 0 && (
              <button onClick={() => setShowAdd(true)} className="btn-primary px-6 py-2.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add first person
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((person, i) => (
              <button
                key={person._id}
                onClick={() => setSelectedPerson(person)}
                className="text-left rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] animate-fade-in-up"
                style={{
                  animationDelay: `${i * 40}ms`,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      background: person.balance >= 0 ? "rgba(63,185,80,0.15)" : "rgba(248,81,73,0.15)",
                      color: person.balance >= 0 ? "#3fb950" : "#f85149",
                    }}
                  >
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{person.name}</p>
                    {person.note && <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{person.note}</p>}
                  </div>
                </div>

                {/* Balance */}
                <div
                  className="rounded-xl px-3 py-2 mb-3"
                  style={{
                    background: person.balance >= 0 ? "rgba(63,185,80,0.08)" : "rgba(248,81,73,0.08)",
                    border: `1px solid ${person.balance >= 0 ? "rgba(63,185,80,0.2)" : "rgba(248,81,73,0.2)"}`,
                  }}
                >
                  <p className="text-xs font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
                    {person.balance >= 0 ? "They owe you" : "You owe them"}
                  </p>
                  <p className="text-lg font-bold tabular-nums" style={{ color: person.balance >= 0 ? "#3fb950" : "#f85149" }}>
                    {person.balance >= 0 ? "+" : "-"}৳{fmt(person.balance)}
                  </p>
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>{person.entryCount} transaction{person.entryCount !== 1 ? "s" : ""}</span>
                  <span>{person.lastEntryDate ? fmtDate(person.lastEntryDate) : "No entries"}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showAdd && (
        <AddPersonModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      )}
      {selectedPerson && (
        <PersonDetailModal
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
          onPersonUpdate={handlePersonUpdate}
          onPersonDelete={handlePersonDelete}
        />
      )}
    </div>
  );
}
