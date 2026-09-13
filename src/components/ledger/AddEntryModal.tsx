"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  LedgerEntry, LedgerPersonWithBalance, EntryType,
} from "@/lib/types";
import { api, errorMessage } from "@/lib/apiClient";
import { toMinor } from "@/lib/money";
import { findPersonByName, suggestPersons, tidyPersonName } from "@/lib/ledgerPeople";
import Modal from "@/components/ui/Modal";
import Money from "@/components/ui/Money";
import OptionCard from "@/components/ui/OptionCard";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/ToastProvider";
import { ENTRY_DIRECTIONS, entryDirection } from "@/components/ledger/entryDirections";
import {
  AlertIcon, CheckIcon, PlusIcon, ScalesIcon, SpinnerIcon, UsersIcon,
} from "@/components/ui/icons";

/** What `POST /api/ledger/entries` hands back. */
interface QuickEntryResponse {
  person: LedgerPersonWithBalance;
  entry: LedgerEntry;
  personCreated: boolean;
}

interface AddEntryModalProps {
  /** The book as the list has it, for the picker and the balance preview. */
  persons: LedgerPersonWithBalance[];
  onClose: () => void;
  /** Receives the person with their balance already settled by the server. */
  onSaved: (person: LedgerPersonWithBalance, personCreated: boolean) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Add a receivable or a payable in one screen, from the ledger list.
 *
 * Adding money used to mean: open "Add person", fill a three-step wizard, close
 * it, find the new row, open it, then fill the transaction wizard — six moves
 * for something that is four facts (which way, how much, who, when). Worse, the
 * common case is a person *already* in the book, where the first three moves are
 * pure overhead spent hunting for a row.
 *
 * So: one panel, no steps. The direction and the amount come first because they
 * are the entry; the person is a single field that both searches the book and
 * accepts a name that is not in it yet, which is the one thing that made the
 * old flow two flows. The person modal keeps its wizard — a statement being
 * read line by line is a different job from writing one line down fast.
 */
export default function AddEntryModal({ persons, onClose, onSaved }: AddEntryModalProps) {
  const toast = useToast();

  const [type, setType] = useState<EntryType>("receivable");
  const [amount, setAmount] = useState("");
  const [personQuery, setPersonQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => { amountRef.current?.focus(); }, []);

  const direction = entryDirection(type);
  const amountMinor = toMinor(amount) ?? 0;

  /*
   * Who this lands on, resolved the same way the server resolves it: an
   * explicit pick wins, and a typed name that already belongs to somebody
   * attaches to them rather than making a second row of the same person. Doing
   * it here as well is what lets the panel *say so* before the save, instead of
   * the user discovering it in the list afterwards.
   */
  const picked = pickedId ? persons.find((person) => person._id === pickedId) ?? null : null;
  const matched = picked ?? findPersonByName(persons, personQuery);
  const typedName = tidyPersonName(personQuery);

  /* Where this entry leaves them. Worth saying out loud in the one case that
     closes a balance out: an amount that is exactly what is outstanding is
     almost always somebody settling up, and confirming that before the save is
     cheaper than reading the row afterwards to find out. */
  const nextBalanceMinor = matched
    ? matched.balanceMinor + amountMinor * direction.sign
    : amountMinor * direction.sign;
  const settlesUp = matched !== null && matched.balanceMinor !== 0 && nextBalanceMinor === 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!typedName) {
      setError("Say who this entry is for.");
      return;
    }
    if (amountMinor <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await api<QuickEntryResponse>("/api/ledger/entries", {
        method: "POST",
        body: {
          type,
          // Sent as typed; the schema converts to minor units server-side.
          amount,
          note: note.trim() || undefined,
          date,
          /* One or the other, never both — the schema rejects a body carrying
             two answers to "who", because a server picking between them is a
             server deciding whose money this is. */
          ...(matched ? { personId: matched._id } : { personName: typedName }),
        },
      });

      onSaved(result.person, result.personCreated);
      onClose();
      toast.success(
        result.personCreated
          ? `${result.person.name} added, with the first entry.`
          : `Entry added for ${result.person.name}.`
      );
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add entry"
      subtitle="Money owed, either way"
      icon={<ScalesIcon className="w-5 h-5" />}
      /* The panel is five field groups plus a preview — taller than a phone in
         landscape, and a form whose amount field cannot be reached is worse
         than one that scrolls. `scrollable` hands the height budget to the
         child, which is why the form supplies its own padding and scroller
         below. */
      scrollable
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col" noValidate>
        {/* The fields scroll; the footer does not. Reaching "Add entry" should
            never depend on having scrolled to the end of a form the user has
            already finished filling in. */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <span className="field-label">Direction</span>
            {/* Stacked rather than side by side, matching the same choice in the
                add-person wizard: two columns inside a modal this width breaks
                "They owe me" across two lines and turns its one-line explanation
                into three. */}
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Direction">
              {ENTRY_DIRECTIONS.map((choice) => (
                <OptionCard
                  key={choice.value}
                  selected={type === choice.value}
                  onSelect={() => setType(choice.value)}
                  title={choice.label}
                  copy={choice.copy}
                  icon={choice.icon}
                  color={choice.color}
                  onColor={choice.onColor}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="entry-amount" className="field-label">
              Amount <span style={{ color: "var(--red)" }}>*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-semibold pointer-events-none text-ink-muted">
                ৳
              </span>
              <input
                ref={amountRef}
                id="entry-amount"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                className="input-dark pl-9 !h-12 text-lg font-semibold"
              />
            </div>
          </div>

          <PersonField
            persons={persons}
            query={personQuery}
            picked={picked}
            onQueryChange={(value) => { setPersonQuery(value); setPickedId(null); }}
            onPick={(person) => { setPickedId(person._id); setPersonQuery(person.name); }}
            disabled={saving}
          />

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            <div>
              <label htmlFor="entry-date" className="field-label">Date</label>
              <input
                id="entry-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="input-dark"
              />
            </div>
            <div>
              <label htmlFor="entry-note" className="field-label">
                Note <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <input
                id="entry-note"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What it was for…"
                maxLength={200}
                className="input-dark"
              />
            </div>
          </div>

          {/*
            What the book will say once this is saved. A balance is the only
            figure in this app that a user cannot check by looking at the thing
            they just typed, so it is shown before the save rather than after —
            and for a person already in the book, the move from one number to
            another is the sentence that catches a wrong direction.
          */}
          {amountMinor > 0 && (
            <div className="well px-3.5 py-3 flex items-center justify-between gap-3 animate-fade-in">
              <span className="min-w-0 flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-well flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${direction.color} 14%, transparent)`,
                    color: direction.color,
                  }}
                >
                  {direction.icon}
                </span>
                <span className="min-w-0">
                  {/* The matched person's name as the book spells it, not as
                      it was typed: "rahim uddin" resolving to "Rahim Uddin" is
                      the thing this line exists to confirm. */}
                  <span className="block text-xs font-bold truncate text-ink">
                    {matched?.name ?? (typedName || "Nobody yet")}
                  </span>
                  <span className="block text-[11px] text-ink-muted">
                    {settlesUp ? "Settles up in full" : direction.label}
                  </span>
                </span>
              </span>

              {matched ? (
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <Money minor={matched.balanceMinor} size="sm" tone="neutral" signed />
                  <span className="text-ink-muted" aria-hidden="true">→</span>
                  <Money minor={nextBalanceMinor} size="md" signed />
                </span>
              ) : (
                <Money minor={amountMinor * direction.sign} size="md" signed />
              )}
            </div>
          )}

          {error && (
            <p className="alert-error animate-fade-in" role="alert">
              <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 sm:px-6 py-4 border-t border-line flex-shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className="btn-outline">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? <SpinnerIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
            {saving ? "Adding…" : "Add entry"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface PersonFieldProps {
  persons: LedgerPersonWithBalance[];
  query: string;
  /** Set only when a suggestion was chosen, which pins the pick to an id. */
  picked: LedgerPersonWithBalance | null;
  onQueryChange: (value: string) => void;
  onPick: (person: LedgerPersonWithBalance) => void;
  disabled: boolean;
}

/**
 * One field that both finds a person and names a new one.
 *
 * A select plus a separate "or add new" input would make the user classify the
 * person before naming them — and they often do not know which it is, because
 * whether "the tailor" is already in the book is exactly what they came here to
 * find out. Typing answers both: the list narrows if they are there, and the
 * same text becomes the new person if they are not.
 */
function PersonField({
  persons, query, picked, onQueryChange, onPick, disabled,
}: PersonFieldProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const suggestions = useMemo(
    () => (open ? suggestPersons(persons, query) : []),
    [open, persons, query]
  );

  const exact = findPersonByName(persons, query);
  const typed = tidyPersonName(query);
  const isNew = typed.length > 0 && !exact;

  const choose = (person: LedgerPersonWithBalance) => {
    onPick(person);
    setOpen(false);
    setHighlight(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((current) => {
        const next = current + step;
        if (next < 0) return suggestions.length - 1;
        return next >= suggestions.length ? 0 : next;
      });
      return;
    }

    if (event.key === "Enter" && open && highlight >= 0 && suggestions[highlight]) {
      // Otherwise Enter submits the form with a half-made choice on screen.
      event.preventDefault();
      choose(suggestions[highlight]);
      return;
    }

    if (event.key === "Escape" && open) {
      /* Closes the list, not the modal: the shell listens for Escape on the
         window, and losing the whole half-typed entry to a keypress meant for
         a dropdown is the kind of thing nobody reports and everybody resents. */
      event.stopPropagation();
      setOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div>
      <label htmlFor={`${listId}-input`} className="field-label">
        Person <span style={{ color: "var(--red)" }}>*</span>
      </label>

      <div className="relative">
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlight >= 0 && suggestions[highlight] ? `${listId}-${highlight}` : undefined
          }
          autoComplete="off"
          value={query}
          disabled={disabled}
          onChange={(event) => { onQueryChange(event.target.value); setOpen(true); setHighlight(-1); }}
          onFocus={() => setOpen(true)}
          // Blur closes on a delay-free path: the options commit on mousedown,
          // which fires before blur, so nothing is lost by closing here.
          onBlur={() => { setOpen(false); setHighlight(-1); }}
          onKeyDown={handleKeyDown}
          placeholder="Search the book, or type a new name…"
          maxLength={100}
          className="input-dark"
        />

        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching people"
            className="absolute z-20 left-0 right-0 mt-1 p-1 rounded-well shadow-lg max-h-56 overflow-y-auto"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {suggestions.map((person, index) => (
              <li
                key={person._id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlight}
                onMouseDown={(event) => { event.preventDefault(); choose(person); }}
                onMouseEnter={() => setHighlight(index)}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-control cursor-pointer"
                style={{ background: index === highlight ? "var(--bg-sunken)" : "transparent" }}
              >
                <Avatar
                  name={person.name}
                  variant="square"
                  size="sm"
                  tone={person.balanceMinor >= 0 ? "green" : "red"}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold truncate text-ink">
                    {person.name}
                  </span>
                  {person.note && (
                    <span className="block text-[11px] truncate text-ink-muted">
                      {person.note}
                    </span>
                  )}
                </span>
                <Money minor={person.balanceMinor} size="sm" signed />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Which of the two things this field is about to do, said plainly. The
          user is one keystroke from either, and only the app knows which. */}
      <span className="field-hint flex items-center gap-1.5">
        {picked || exact ? (
          <>
            <UsersIcon className="w-3.5 h-3.5 flex-shrink-0" />
            Adds to {(picked ?? exact)!.name}&rsquo;s ledger.
          </>
        ) : isNew ? (
          <>
            <PlusIcon className="w-3.5 h-3.5 flex-shrink-0" />
            New person — &ldquo;{typed}&rdquo; will be added to the book.
          </>
        ) : (
          persons.length > 0
            ? "Start typing to search, or enter a name that is not in the book yet."
            : "Your first entry — the person is created along with it."
        )}
      </span>
    </div>
  );
}
