"use client";

import { useState } from "react";
import {
  TaskService, TaskSubtask,
  SERVICE_FIELDS, SERVICE_LABELS, SERVICE_COLORS, SERVICE_TEXT_COLORS,
  SERVICE_ON_COLORS,
  describeSubtaskFields, missingFieldCount, subtaskProgress,
} from "@/lib/types";
import { subtaskStatusHint } from "@/lib/taskStatus";
import ProgressBar from "@/components/ui/ProgressBar";
import SubtaskFieldInput from "@/components/task/SubtaskFieldInput";
import {
  CheckIcon, EditIcon, EyeIcon, EyeOffIcon, SpinnerIcon,
} from "@/components/ui/icons";

/** Values for one sub-task, keyed by `ServiceFieldDef.key`. */
export type SubtaskFields = Record<string, string>;

interface SubtaskChecklistProps {
  subtasks: TaskSubtask[];
  /** Persists the tick. Rejecting the promise rolls the row back. */
  onToggleDone: (service: TaskService) => Promise<void>;
  /**
   * Persists edited values for one sub-task. Receives every field the service
   * defines, blanks included — a blank is how a value gets cleared.
   */
  onSaveFields: (service: TaskService, fields: SubtaskFields) => Promise<void>;
  /** True while a task-level action is in flight, which disables the rest. */
  busy?: boolean;
}

/**
 * The ticked services as a working checklist on the task page.
 *
 * The task's own status says whether the *whole* errand is finished, which is
 * too coarse for a customer who brought three jobs: two collected, one still at
 * the passport office reads as "in progress" either way. Ticking the legs off
 * individually is the only thing on this page that says which one is waiting —
 * and, since the checklist now drives the status, it is also the only thing the
 * operator has to do to close the task out.
 *
 * Each row edits in place. Sending someone to the full edit wizard to correct
 * one digit of a passport number meant re-walking a five-step form for a
 * two-character change, and that number is usually corrected at the counter
 * with the customer standing there. Credentials render masked; revealing one is
 * per-field and resets on navigation.
 */
export default function SubtaskChecklist({
  subtasks, onToggleDone, onSaveFields, busy = false,
}: SubtaskChecklistProps) {
  const progress = subtaskProgress(subtasks);
  /* Only one row is open at a time. Two half-finished edits on one screen is
     two ways to lose the one you forgot about. */
  const [editing, setEditing] = useState<TaskService | null>(null);

  return (
    <section className="panel">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-eyebrow">Sub-tasks ({progress.total})</h2>
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          {progress.done} of {progress.total} done
        </span>
      </div>

      {/* `ProgressBar` takes a percentage, and `total` is never 0 here — the
          whole section is omitted when there are no sub-tasks. */}
      <ProgressBar
        value={(progress.done / progress.total) * 100}
        label={`${progress.done} of ${progress.total} sub-tasks done`}
      />

      {/* The status rule, said out loud where the ticking happens — a task that
          completes itself is only a good surprise if it was not a surprise. */}
      <p className="text-[11px] leading-snug mt-2.5 text-ink-muted">
        {subtaskStatusHint(subtasks)}
      </p>

      <ul className="flex flex-col gap-2 mt-4">
        {subtasks.map((subtask) => (
          <SubtaskRow
            key={subtask.service}
            subtask={subtask}
            onToggleDone={onToggleDone}
            onSaveFields={onSaveFields}
            editing={editing === subtask.service}
            onEdit={() => setEditing(subtask.service)}
            onCloseEdit={() => setEditing(null)}
            busy={busy}
          />
        ))}
      </ul>
    </section>
  );
}

interface SubtaskRowProps {
  subtask: TaskSubtask;
  onToggleDone: (service: TaskService) => Promise<void>;
  onSaveFields: (service: TaskService, fields: SubtaskFields) => Promise<void>;
  editing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
  busy: boolean;
}

function SubtaskRow({
  subtask, onToggleDone, onSaveFields, editing, onEdit, onCloseEdit, busy,
}: SubtaskRowProps) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { service, done } = subtask;
  const color = SERVICE_COLORS[service];
  const definitions = SERVICE_FIELDS[service];
  /* Described masked, then the one revealed field is swapped back from the
     source. Passing `revealSecrets` here would uncover every credential on the
     row at once, which is only invisible today because no service defines two. */
  const described = describeSubtaskFields(subtask);
  const missing = missingFieldCount(subtask);

  const toggle = async () => {
    setSaving(true);
    try {
      await onToggleDone(service);
    } finally {
      setSaving(false);
    }
  };

  const save = async (fields: SubtaskFields) => {
    setSaving(true);
    try {
      await onSaveFields(service, fields);
      onCloseEdit();
    } finally {
      setSaving(false);
    }
  };

  return (
    <li
      className="well p-3.5 flex items-start gap-3"
      data-subtask={service}
      data-done={done}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {/* The whole tick is one button rather than a checkbox plus a label, so
          the hit area on a phone is the control and not a 16px square. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark ${SERVICE_LABELS[service]} as ${done ? "not done" : "done"}`}
        onClick={toggle}
        disabled={busy || saving}
        className="w-5 h-5 mt-0.5 rounded-md flex-shrink-0 flex items-center justify-center transition-colors duration-fast disabled:opacity-50"
        style={{
          background: done ? color : "transparent",
          border: `1.5px solid ${done ? color : "var(--border-hover)"}`,
          color: SERVICE_ON_COLORS[service],
        }}
      >
        {saving
          ? <SpinnerIcon className="w-3 h-3" />
          : done && <CheckIcon className="w-3 h-3" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2">
            <span
              className="text-[13px] font-bold leading-tight"
              style={{
                color: SERVICE_TEXT_COLORS[service],
                /* Struck through rather than faded: a finished leg still has to
                   be readable, because the numbers on it are what gets quoted
                   back to the customer when they ring up about it. */
                textDecoration: done ? "line-through" : undefined,
              }}
            >
              {SERVICE_LABELS[service]}
            </span>
            {missing > 0 && (
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {missing} of {definitions.length} not recorded
              </span>
            )}
          </div>

          {/*
            Named for the row it opens, not "Edit" alone: three of these stacked
            with the same accessible name is three identical announcements, and
            the service is the only thing telling them apart.
          */}
          {!editing && (
            <button
              type="button"
              onClick={onEdit}
              disabled={busy || saving}
              className="btn-ghost h-7 px-2 text-[11px] flex-shrink-0 disabled:opacity-50"
              aria-label={`Edit ${SERVICE_LABELS[service]} details`}
            >
              <EditIcon className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <SubtaskRowEditor
            subtask={subtask}
            saving={saving}
            onSave={save}
            onCancel={onCloseEdit}
          />
        ) : (
          described.length > 0 && (
            <dl className="mt-1.5 flex flex-col gap-1">
              {described.map((field) => (
                <div key={field.key} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <dt style={{ color: "var(--text-muted)" }}>{field.label}</dt>
                  <dd
                    className={field.secret ? "font-mono" : "font-medium"}
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {field.secret && revealed === field.key
                      ? subtask.fields[field.key]
                      : field.value}
                  </dd>
                  {field.secret && (
                    <button
                      type="button"
                      onClick={() =>
                        setRevealed((current) => (current === field.key ? null : field.key))
                      }
                      aria-pressed={revealed === field.key}
                      aria-label={
                        revealed === field.key
                          ? `Hide ${field.label}`
                          : `Show ${field.label}`
                      }
                      className="text-ink-muted hover:text-ink transition-colors duration-fast"
                    >
                      {revealed === field.key
                        ? <EyeOffIcon className="w-3.5 h-3.5" />
                        : <EyeIcon className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              ))}
            </dl>
          )
        )}
      </div>
    </li>
  );
}

interface SubtaskRowEditorProps {
  subtask: TaskSubtask;
  saving: boolean;
  onSave: (fields: SubtaskFields) => Promise<void>;
  onCancel: () => void;
}

/**
 * The open row: every field the service asks for, in a draft of its own.
 *
 * The draft is local until Save, so an abandoned edit leaves nothing behind and
 * a failed request leaves the typing on screen to retry rather than discarding
 * it — which matters most for exactly the values that are tedious to re-enter.
 */
function SubtaskRowEditor({ subtask, saving, onSave, onCancel }: SubtaskRowEditorProps) {
  const [draft, setDraft] = useState<SubtaskFields>(() =>
    Object.fromEntries(
      SERVICE_FIELDS[subtask.service].map((definition) => [
        definition.key,
        subtask.fields[definition.key] ?? "",
      ])
    )
  );

  const change = (_service: TaskService, key: string, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(draft);
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SERVICE_FIELDS[subtask.service].map((definition) => (
          <SubtaskFieldInput
            key={definition.key}
            service={subtask.service}
            definition={definition}
            value={draft[definition.key] ?? ""}
            onChange={change}
            disabled={saving}
            /* The wizard uses the bare `subtask-` prefix; a page that ever
               rendered both would otherwise duplicate every input's id. */
            idPrefix="task-subtask"
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary h-9 px-4 text-xs" disabled={saving}>
          {saving ? <SpinnerIcon className="w-3.5 h-3.5" /> : <CheckIcon className="w-3.5 h-3.5" />}
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost h-9 px-3 text-xs"
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
