"use client";

import { useMemo, useState } from "react";
import { LedgerPersonWithBalance } from "@/lib/types";
import AppShell from "@/components/shell/AppShell";
import AddPersonModal from "@/components/AddPersonModal";
import PersonDetailModal from "@/components/PersonDetailModal";
import PageToolbar, { SortOption } from "@/components/ui/PageToolbar";
import EmptyState from "@/components/ui/EmptyState";
import Avatar from "@/components/ui/Avatar";
import Money from "@/components/ui/Money";
import {
  ArrowUpIcon, ArrowDownIcon, UsersIcon, PlusIcon, ChevronRightIcon,
} from "@/components/ui/icons";
import { useServerData } from "@/hooks/useServerData";

interface LedgerClientProps {
  initialPersons: LedgerPersonWithBalance[];
}

type SortKey = "recent" | "highest" | "name";

const SORT_OPTIONS: SortOption[] = [
  { value: "recent", label: "Recent activity" },
  { value: "highest", label: "Largest balance" },
  { value: "name", label: "Name" },
];

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "No entries";

function sortPersons(
  persons: LedgerPersonWithBalance[],
  key: SortKey
): LedgerPersonWithBalance[] {
  switch (key) {
    case "highest":
      return [...persons].sort(
        (a, b) => Math.abs(b.balanceMinor) - Math.abs(a.balanceMinor)
      );
    case "name":
      return [...persons].sort((a, b) => a.name.localeCompare(b.name));
    default:
      return [...persons].sort((a, b) => {
        const aTime = a.lastEntryDate ? new Date(a.lastEntryDate).getTime() : 0;
        const bTime = b.lastEntryDate ? new Date(b.lastEntryDate).getTime() : 0;
        return bTime - aTime;
      });
  }
}

/**
 * Receivables and payables, laid out as a statement.
 *
 * A card grid made comparing two balances a hunt across the page. Hairline-
 * ruled rows put every figure in one right-aligned column, with the net
 * position promoted to a single hero number above them.
 */
export default function LedgerClient({ initialPersons }: LedgerClientProps) {
  const [persons, setPersons] = useServerData<LedgerPersonWithBalance[]>(initialPersons);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<LedgerPersonWithBalance | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  const totals = useMemo(() => {
    const receivable = persons.reduce((sum, p) => sum + Math.max(0, p.balanceMinor), 0);
    const payable = persons.reduce((sum, p) => sum + Math.max(0, -p.balanceMinor), 0);
    return { receivable, payable, net: receivable - payable };
  }, [persons]);

  const visiblePersons = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = persons.filter(
      (person) =>
        !query ||
        person.name.toLowerCase().includes(query) ||
        (person.note?.toLowerCase().includes(query) ?? false)
    );
    return sortPersons(filtered, sortKey);
  }, [persons, search, sortKey]);

  const handleAdd = (person: LedgerPersonWithBalance) =>
    setPersons((current) => [person, ...current]);

  const handlePersonUpdate = (updated: LedgerPersonWithBalance) => {
    setPersons((current) => current.map((p) => (p._id === updated._id ? updated : p)));
    setSelectedPerson((current) => (current?._id === updated._id ? updated : current));
  };

  const handlePersonDelete = (id: string) => {
    setPersons((current) => current.filter((person) => person._id !== id));
    setSelectedPerson(null);
  };

  return (
    <AppShell workspace="Receivables & Payables">
      <PageToolbar
        title="Ledger"
        count={persons.length}
        searchValue={search}
        searchPlaceholder="Search people…"
        onSearchChange={setSearch}
        sortOptions={SORT_OPTIONS}
        sortValue={sortKey}
        onSortChange={(value) => setSortKey(value as SortKey)}
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="btn-secondary flex-shrink-0"
            id="add-person-btn"
          >
            <PlusIcon className="w-4 h-4" />
            Add person
          </button>
        }
      />

      {persons.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-7">
          {/* The one figure that answers "where do I stand". */}
          <section className="panel-hero lg:col-span-1 p-5 sm:p-6 flex flex-col justify-center">
            <p className="text-eyebrow mb-2">Net position</p>
            <Money minor={totals.net} size="hero" signed />
            <p className="text-sm mt-2 text-ink-secondary">
              {totals.net >= 0
                ? "Owed to you across all people"
                : "You owe more than you are owed"}
            </p>
          </section>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 animate-stagger">
            {[
              {
                label: "Total receivable",
                hint: "Others owe you",
                minor: totals.receivable,
                color: "var(--green)",
                icon: <ArrowUpIcon className="w-4 h-4" />,
              },
              {
                label: "Total payable",
                hint: "You owe others",
                minor: totals.payable,
                color: "var(--red)",
                icon: <ArrowDownIcon className="w-4 h-4" />,
              },
            ].map((item) => (
              <article key={item.label} className="card p-5 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-7 h-7 rounded-well flex items-center justify-center"
                    style={{
                      background: `color-mix(in srgb, ${item.color} 14%, transparent)`,
                      color: item.color,
                    }}
                  >
                    {item.icon}
                  </span>
                  <p className="text-eyebrow">{item.label}</p>
                </div>
                <Money minor={item.minor} size="lg" tone="neutral" />
                <p className="text-xs mt-1 text-ink-muted">{item.hint}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      {visiblePersons.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="w-9 h-9" />}
          title={persons.length === 0 ? "No people yet" : "Nothing matches that"}
          description={
            persons.length === 0
              ? "Add someone to start tracking what you owe and what you are owed."
              : "Try a different search term."
          }
          action={
            persons.length === 0 ? (
              <button onClick={() => setShowAdd(true)} className="btn-primary px-6">
                <PlusIcon className="w-4 h-4" />
                Add first person
              </button>
            ) : (
              <button onClick={() => setSearch("")} className="btn-outline">
                Clear search
              </button>
            )
          }
        />
      ) : (
        <div className="statement">
          <div className="statement-head">
            <span className="text-eyebrow flex-1">Person</span>
            <span className="text-eyebrow hidden sm:block w-28 text-right">Last activity</span>
            <span className="text-eyebrow w-32 text-right">Balance</span>
            <span className="w-4" aria-hidden="true" />
          </div>

          {visiblePersons.map((person) => {
            const owed = person.balanceMinor >= 0;
            const tone = owed ? "green" : "red";

            return (
              <button
                key={person._id}
                onClick={() => setSelectedPerson(person)}
                className="statement-row group"
              >
                <Avatar name={person.name} variant="square" size="md" tone={tone} />

                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-sm truncate text-ink">
                    {person.name}
                  </span>
                  <span className="block text-xs truncate text-ink-muted">
                    {person.note ??
                      `${person.entryCount} entr${person.entryCount === 1 ? "y" : "ies"}`}
                  </span>
                </span>

                <span className="hidden sm:block w-28 text-right text-xs text-ink-muted">
                  {formatDate(person.lastEntryDate)}
                </span>

                <span className="w-32 text-right">
                  <Money minor={person.balanceMinor} size="md" signed />
                  <span className="block text-[11px] mt-0.5 text-ink-muted">
                    {owed ? "owes you" : "you owe"}
                  </span>
                </span>

                <ChevronRightIcon className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 text-ink-muted" />
              </button>
            );
          })}
        </div>
      )}

      {showAdd && <AddPersonModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {selectedPerson && (
        <PersonDetailModal
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
          onPersonUpdate={handlePersonUpdate}
          onPersonDelete={handlePersonDelete}
        />
      )}
    </AppShell>
  );
}
