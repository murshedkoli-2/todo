"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { parseQuickAdd, QUICK_ADD_HINTS } from "@/lib/quickAdd";
import { PRIORITY_TEXT_COLORS } from "@/lib/types";
import type { CreateTodoInput } from "@/lib/schemas/todo";
import { BoltIcon, CalendarIcon, FlagIcon, PlusIcon, SpinnerIcon } from "@/components/ui/icons";

export interface QuickAddHandle {
  focus: () => void;
}

interface QuickAddBarProps {
  /** Resolves once the task exists; rejects so the bar can keep the draft. */
  onCreate: (input: Pick<CreateTodoInput, "title" | "priority"> & { dueDate: Date | null }) => Promise<void>;
  /** Opens the full form, carrying whatever has been typed so far. */
  onExpand: (draftTitle: string) => void;
}

/**
 * One-line task capture.
 *
 * Creating a task previously meant a route change to `/tasks/new`, a form with
 * nine controls, a calendar widget and a round trip back — for the common case
 * of "remind me to do X on Friday". This bar takes that to a single line, and
 * shows what it understood *before* submission so the parse is never a
 * surprise: the chips below the field are the task that is about to exist.
 *
 * The full form is still one click away for tasks that need images, payment
 * details or a long description.
 */
const QuickAddBar = forwardRef<QuickAddHandle, QuickAddBarProps>(function QuickAddBar(
  { onCreate, onExpand },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }), []);

  // Re-parsed on every keystroke: the preview has to track the text exactly, and
  // the parse is a handful of regexes over a single line.
  const parsed = useMemo(() => parseQuickAdd(draft), [draft]);

  const canSubmit = parsed.title.length > 0 && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onCreate({
        title: parsed.title,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
      });
      // Cleared only on success — a failed create keeps the text so the user
      // is not made to retype it.
      setDraft("");
    } catch {
      /* The caller reports this; the draft stays put. */
    } finally {
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  return (
    <form
      className="quick-add"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="quick-add-row">
        <span className="quick-add-icon" aria-hidden="true">
          <BoltIcon className="w-4 h-4" />
        </span>

        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft("");
              inputRef.current?.blur();
            }
          }}
          placeholder="Add a task — try “Send invoice friday !high”"
          aria-label="Quick add a task"
          aria-describedby="quick-add-hint"
          className="quick-add-input"
          enterKeyHint="done"
        />

        <button
          type="button"
          onClick={() => onExpand(parsed.title || draft)}
          className="btn-ghost h-9 px-2.5 text-xs flex-shrink-0 hidden sm:inline-flex"
          title="Open the full form for images, payment and notes"
        >
          More options
        </button>

        <button type="submit" disabled={!canSubmit} className="btn-primary h-9 px-3.5 flex-shrink-0">
          {saving ? <SpinnerIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
          <span className="hidden xs:inline">Add</span>
        </button>
      </div>

      {/*
        The preview only appears once there is something to preview, so the
        toolbar does not permanently carry an empty second row.
      */}
      {draft.trim().length > 0 && (
        <div className="quick-add-preview" aria-live="polite">
          <span className="text-eyebrow flex-shrink-0">Will create</span>

          <span className="text-sm font-semibold truncate text-ink">
            {parsed.title || (
              <span className="font-normal text-ink-muted">
                a title — the rest was read as a date or priority
              </span>
            )}
          </span>

          {parsed.dueDate && (
            <span className="pill bg-sunken text-ink-secondary flex-shrink-0">
              <CalendarIcon className="w-3.5 h-3.5" />
              {parsed.tokens.find((token) => token.kind === "date")?.label}
            </span>
          )}

          {parsed.priority !== "none" && (
            <span
              className="pill flex-shrink-0"
              style={{
                background: "var(--bg-sunken)",
                color: PRIORITY_TEXT_COLORS[parsed.priority],
              }}
            >
              <FlagIcon className="w-3.5 h-3.5" />
              {parsed.tokens.find((token) => token.kind === "priority")?.label}
            </span>
          )}
        </div>
      )}

      <p id="quick-add-hint" className="quick-add-hints">
        {QUICK_ADD_HINTS.map((hint) => (
          <span key={hint.syntax} className="quick-add-hint" title={hint.means}>
            {hint.syntax}
          </span>
        ))}
      </p>
    </form>
  );
});

export default QuickAddBar;
