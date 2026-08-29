"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Todo, TodoStatus, TodoPriority, PaymentMethod, SubtaskStatus, TaskService, TaskSubtask,
  STATUS_LABELS, STATUS_COLORS, STATUS_TEXT_COLORS,
  PRIORITY_CHOICES, PRIORITY_LABELS, PRIORITY_COLORS,
  PAYMENT_METHOD_CHOICES, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_COLORS,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_TEXT_COLORS,
  SERVICE_LABELS, formatServices, describeSubtaskFields, normalizeSubtasks,
  subtaskProgress,
} from "@/lib/types";
import { api, errorMessage } from "@/lib/apiClient";
import { fromMinor, toMinor } from "@/lib/money";
import { derivePaymentStatus, dueMinor } from "@/lib/payment";
import { formatDueLabel } from "@/lib/dueDate";
import Money from "@/components/ui/Money";
import AppShell from "@/components/shell/AppShell";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import OptionCard from "@/components/ui/OptionCard";
import SubtaskEditor from "@/components/task/SubtaskEditor";
import Stepper from "@/components/ui/wizard/Stepper";
import WizardPanel from "@/components/ui/wizard/WizardPanel";
import WizardFooter from "@/components/ui/wizard/WizardFooter";
import ReviewList from "@/components/ui/wizard/ReviewList";
import { useWizard, WizardStepDef } from "@/components/ui/wizard/useWizard";
import { useToast } from "@/components/ui/ToastProvider";
import {
  PlusIcon, TrashIcon, ImageIcon, AlertIcon, CloseIcon, CheckIcon, SpinnerIcon,
  CalendarIcon, FlagIcon, BoltIcon,
} from "@/components/ui/icons";

interface TaskFormProps {
  todo?: Todo | null;
  /** Title carried over from the quick-add bar's "More options". */
  initialTitle?: string;
}

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TITLE_LENGTH = 200;

const STATUS_OPTIONS: TodoStatus[] = ["todo", "in_progress", "completed"];
const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "INR", "AED", "SAR"];

const STATUS_COPY: Record<TodoStatus, string> = {
  todo: "Queued up, not started yet",
  in_progress: "Being worked on right now",
  completed: "Finished — nothing left to do",
};

/**
 * Creating and editing a task, as a six-step wizard.
 *
 * The form this replaced put eleven fields on one screen across three panels,
 * ten of them optional. The title — the only thing actually required — carried
 * no more visual weight than the payment currency dropdown, so the fastest path
 * through the form was invisible. Splitting it puts one decision on each screen
 * and lets the required field own its own.
 *
 * Only step one can block progress. Every later step is skippable in a single
 * press, so adding a bare title still costs four keystrokes and five clicks,
 * and the review screen at the end restores the overview the split gave up.
 *
 * Services get a screen of their own rather than a corner of step one, because
 * ticking one is not a single decision: each tick opens a sub-task with its own
 * questions — a birth number, a date, a portal password — and nine of those
 * unfolding underneath the title field would bury the one required input.
 */
export default function TaskForm({ todo, initialTitle = "" }: TaskFormProps) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(todo);

  const [title, setTitle]                   = useState(todo?.title ?? initialTitle);
  const [description, setDescription]       = useState(todo?.description ?? "");
  const [status, setStatus]                 = useState<TodoStatus>(todo?.status ?? "todo");
  const [priority, setPriority]             = useState<TodoPriority>(todo?.priority ?? "none");
  const [dueDate, setDueDate]               = useState(todo?.dueDate ? todo.dueDate.slice(0, 10) : "");
  /* One piece of state, not two. `services` is derived from this on the way
     out, so a ticked job can never be missing its sub-task and a sub-task can
     never survive its job being unticked. */
  const [subtasks, setSubtasks]             = useState<TaskSubtask[]>(
    () => normalizeSubtasks(todo?.services ?? [], todo?.subtasks ?? []).subtasks
  );
  const [images, setImages]                 = useState<string[]>(todo?.images ?? []);
  const [featureImage, setFeatureImage]     = useState<string>(todo?.featureImage ?? "");
  // Stored in minor units; the fields edit major units, converted on submit.
  const [paymentAmount, setPaymentAmount]   = useState(
    todo?.paymentAmountMinor != null
      ? String(fromMinor(todo.paymentAmountMinor, todo.paymentCurrency))
      : ""
  );
  const [paidAmount, setPaidAmount]         = useState(
    todo?.paidAmountMinor != null
      ? String(fromMinor(todo.paidAmountMinor, todo.paymentCurrency))
      : ""
  );
  const [paymentCurrency, setPaymentCurrency] = useState(todo?.paymentCurrency ?? "BDT");
  const [paymentMethod, setPaymentMethod]   = useState<PaymentMethod>(
    todo?.paymentMethod ?? "unset"
  );

  const [saving, setSaving]                 = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [error, setError]                   = useState("");
  const [uploadingCount, setUploadingCount] = useState(0);
  const [dragging, setDragging]             = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Uploads ─────────────────────────────────────────────────────────── */
  const uploadFile = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files can be attached.");
      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Each image must be under 5 MB.");
      return null;
    }
    const body = new FormData();
    body.append("file", file);

    // `api()` is JSON-only; multipart needs the raw fetch so the browser can
    // set its own multipart boundary.
    const response = await fetch("/api/upload", { method: "POST", body });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setError(payload?.error ?? "Upload failed. Please try again.");
      return null;
    }
    return payload.url as string;
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) {
        setError(`You can attach up to ${MAX_IMAGES} images.`);
        return;
      }
      const batch = incoming.slice(0, remaining);
      if (incoming.length > remaining) setError(`Only ${remaining} more image(s) could be added.`);
      else setError("");

      setUploadingCount((n) => n + batch.length);
      const urls = (await Promise.all(batch.map(uploadFile))).filter(Boolean) as string[];
      setImages((prev) => [...prev, ...urls]);
      setFeatureImage((current) => current || urls[0] || "");
      setUploadingCount((n) => n - batch.length);
    },
    [images.length]
  );

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) await handleFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) await handleFiles(e.dataTransfer.files);
  };

  /* ── Sub-tasks ───────────────────────────────────────────────────────── */

  /*
   * Untick then re-tick discards whatever was typed against that service.
   *
   * The alternative — parking the values in case the tick comes back — means a
   * password the operator deliberately removed is silently still in the payload
   * on save, which is the wrong default for a field holding a credential.
   * Rebuilt through `normalizeSubtasks` so the rows stay in catalogue order
   * however the tiles were tapped, matching the order the server stores.
   */
  const toggleService = (service: TaskService) => {
    setSubtasks((current) => {
      const next = current.some((subtask) => subtask.service === service)
        ? current.filter((subtask) => subtask.service !== service)
        : [...current, { service, status: "todo" as const, fields: {} }];
      return normalizeSubtasks(next.map((subtask) => subtask.service), next).subtasks;
    });
  };

  const setSubtaskField = (service: TaskService, key: string, value: string) => {
    setSubtasks((current) =>
      current.map((subtask) =>
        subtask.service === service
          ? { ...subtask, fields: { ...subtask.fields, [key]: value } }
          : subtask
      )
    );
  };

  const setSubtaskStatus = (service: TaskService, status: SubtaskStatus) => {
    setSubtasks((current) =>
      current.map((subtask) =>
        subtask.service === service ? { ...subtask, status } : subtask
      )
    );
  };

  const services = subtasks.map((subtask) => subtask.service);
  const progress = subtaskProgress(subtasks);

  const removeImage = (url: string) => {
    const next = images.filter((u) => u !== url);
    setImages(next);
    if (featureImage === url) setFeatureImage(next[0] ?? "");
  };

  /*
   * Live payment summary. Parsed through the same `toMinor` the schema uses, so
   * what the form shows before saving is what the server will compute after —
   * a preview derived a second way would eventually disagree with the badge on
   * the task it produced.
   */
  const totalMinor = toMinor(paymentAmount, paymentCurrency);
  const paidMinor = toMinor(paidAmount, paymentCurrency);
  const due = dueMinor(totalMinor, paidMinor);
  const derivedStatus = derivePaymentStatus(totalMinor, paidMinor);

  /* ── Steps ───────────────────────────────────────────────────────────── */
  const steps: WizardStepDef[] = [
    {
      id: "details",
      label: "Details",
      description: "Start with what has to happen. The title is the only thing required.",
      validate: () => (title.trim() ? null : "A title is required."),
    },
    {
      id: "services",
      label: "Services",
      description:
        "Tick every job this task covers. Each one opens a sub-task asking for what that job needs.",
    },
    {
      id: "schedule",
      label: "Schedule",
      description: "Where does this sit right now, and when does it need to be done?",
    },
    {
      id: "payment",
      label: "Payment",
      description: "Only if money is attached to this task. Skip it otherwise.",
      validate: () => {
        if (paymentAmount !== "" && totalMinor === null) return "That total is not a valid amount.";
        if (paidAmount !== "" && paidMinor === null) return "That paid amount is not a valid amount.";
        return null;
      },
    },
    {
      id: "attachments",
      label: "Images",
      description: "Attach screenshots, receipts, or references. One of them becomes the task's cover.",
      validate: () =>
        uploadingCount > 0 ? "Please wait for the uploads to finish." : null,
    },
    {
      id: "review",
      label: "Review",
      description: isEdit
        ? "Check the changes before saving them."
        : "Check everything before the task is created.",
    },
  ];

  const wizard = useWizard(steps);

  /* ── Persistence ─────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The forward control is only a submit button on the last step, but Enter
    // inside a text field still fires the form — so advance instead of saving.
    if (!wizard.isLast) { wizard.next(); return; }
    if (uploadingCount > 0) { setError("Please wait for the uploads to finish."); return; }

    setSaving(true);
    setError("");
    try {
      // Empty strings are sent as `null`, not "": the schema treats null as
      // "clear this field" and would reject "" as an invalid date or URL.
      const payload = {
        title,
        description,
        status,
        priority,
        dueDate: dueDate || null,
        services,
        subtasks,
        images,
        featureImage: featureImage || null,
        // Sent in major units; the schema converts to integer minor units.
        // `paymentStatus` is not sent: the service derives it from these two.
        paymentAmount: paymentAmount !== "" ? paymentAmount : null,
        paidAmount: paidAmount !== "" ? paidAmount : null,
        paymentCurrency,
        paymentMethod,
      };

      await api(isEdit ? `/api/todos/${todo!._id}` : "/api/todos", {
        method: isEdit ? "PATCH" : "POST",
        body: payload,
      });

      toast.success(isEdit ? "Task saved." : "Task created.");

      /*
       * Refresh *before* navigating, not after.
       *
       * Next keeps a client-side Router Cache of visited routes, and `/tasks`
       * is in it — the user came from there. Pushing straight back renders that
       * cached payload, which was captured before this task existed. Refreshing
       * first invalidates the cache, so the push that follows fetches the list
       * as it is now and the task is on screen the moment the page is.
       *
       * The old order did land the fresh data eventually, but only after the
       * stale list had already painted.
       */
      router.refresh();
      router.push("/tasks");
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!todo) return;
    setDeleting(true);
    setError("");
    try {
      await api(`/api/todos/${todo._id}`, { method: "DELETE" });
      toast.success("Task deleted.");
      // Same ordering as the save path above: invalidate, then navigate, so the
      // list never paints with the deleted task still in it.
      router.refresh();
      router.push("/tasks");
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const busy = saving || deleting;

  return (
    <AppShell workspace="My Workspace">
      <Breadcrumb items={[{ label: "Tasks", href: "/tasks" }, { label: isEdit ? "Edit task" : "New task" }]} />

      <div className="max-w-2xl mx-auto">
        <header className="mb-6 animate-fade-in-up">
          <h1 className="text-display">
            {isEdit ? "Edit " : "Create a "}
            <span className="text-brand-gradient">task</span>
          </h1>
          <p className="text-sm mt-1 text-ink-secondary">
            {steps.length} quick steps — only the first one is required.
          </p>
        </header>

        <section className="panel animate-fade-in-up">
          <Stepper wizard={wizard} />

          <div className="mt-6">
            <form onSubmit={handleSubmit} noValidate>
              <WizardPanel wizard={wizard}>
                {/* ── 1. Details ─────────────────────────────────────── */}
                {wizard.current.id === "details" && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <label htmlFor="task-title" className="field-label">
                        Title <span style={{ color: "var(--red)" }}>*</span>
                      </label>
                      <input
                        id="task-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="What needs to be done?"
                        className="input-dark !h-12 text-base font-medium"
                        maxLength={MAX_TITLE_LENGTH}
                        required
                        autoFocus
                      />
                      <span className="field-hint">
                        {title.length}/{MAX_TITLE_LENGTH} · a verb and an object reads best — “Send the March invoice”.
                      </span>
                    </div>

                    <div>
                      <label htmlFor="task-description" className="field-label">
                        Description <span className="font-normal text-ink-muted">(optional)</span>
                      </label>
                      <textarea
                        id="task-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add context, links, or notes…"
                        className="input-dark resize-none"
                        rows={6}
                        maxLength={2000}
                      />
                    </div>
                  </div>
                )}

                {/* ── 2. Services ────────────────────────────────────── */}
                {wizard.current.id === "services" && (
                  <SubtaskEditor
                    subtasks={subtasks}
                    onToggleService={toggleService}
                    onFieldChange={setSubtaskField}
                    onStatusChange={setSubtaskStatus}
                  />
                )}

                {/* ── 3. Schedule ────────────────────────────────────── */}
                {wizard.current.id === "schedule" && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <span className="field-label">Status</span>
                      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Status">
                        {STATUS_OPTIONS.map((option) => (
                          <OptionCard
                            key={option}
                            selected={status === option}
                            onSelect={() => setStatus(option)}
                            title={STATUS_LABELS[option]}
                            copy={STATUS_COPY[option]}
                            icon={<BoltIcon className="w-4 h-4" />}
                            color={STATUS_COLORS[option]}
                            onColor={option === "completed" ? "var(--on-green)" : "var(--on-accent)"}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="field-label">Priority</span>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Priority">
                        {PRIORITY_CHOICES.map((option) => {
                          const active = priority === option;
                          const color = PRIORITY_COLORS[option];
                          return (
                            <button
                              key={option}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setPriority(option)}
                              className="option-tile flex-1 min-w-[5.5rem] !flex-row !py-2.5 gap-2"
                              data-selected={active}
                              style={
                                active
                                  ? {
                                      background: `color-mix(in srgb, ${color} 12%, transparent)`,
                                      borderColor: color,
                                      color: "var(--text-primary)",
                                    }
                                  : undefined
                              }
                            >
                              <FlagIcon
                                className="w-3.5 h-3.5 flex-shrink-0"
                                style={{ color: active ? color : "var(--text-muted)" }}
                              />
                              <span className="text-xs font-bold">{PRIORITY_LABELS[option]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="task-due-date" className="field-label">
                        Due date <span className="font-normal text-ink-muted">(optional)</span>
                      </label>
                      <div className="relative">
                        <CalendarIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted" />
                        <input
                          id="task-due-date"
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="input-dark pl-10"
                        />
                      </div>
                      {dueDate && (
                        <span className="field-hint animate-fade-in">
                          Due {formatDueLabel(dueDate)}.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── 4. Payment ─────────────────────────────────────── */}
                {wizard.current.id === "payment" && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <label htmlFor="task-payment-amount" className="field-label">
                        Total cost <span className="font-normal text-ink-muted">(optional)</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          id="task-payment-currency"
                          aria-label="Currency"
                          value={paymentCurrency}
                          onChange={(e) => setPaymentCurrency(e.target.value)}
                          className="input-dark flex-shrink-0 w-24 cursor-pointer"
                        >
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input
                          id="task-payment-amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="0.00"
                          className="input-dark flex-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="task-paid-amount" className="field-label">
                        Paid so far <span className="font-normal text-ink-muted">(optional)</span>
                      </label>
                      <input
                        id="task-paid-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        placeholder="0.00"
                        className="input-dark"
                        aria-describedby="payment-summary"
                      />
                    </div>

                    <div>
                      <span className="field-label">Payment method</span>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
                        {PAYMENT_METHOD_CHOICES.map((option) => {
                          const active = paymentMethod === option;
                          const color = PAYMENT_METHOD_COLORS[option];
                          return (
                            <button
                              key={option}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setPaymentMethod(option)}
                              className="flex items-center gap-2 px-4 h-10 rounded-control text-sm font-semibold transition-all duration-fast"
                              style={{
                                background: active
                                  ? `color-mix(in srgb, ${color} 12%, transparent)`
                                  : "var(--bg-sunken)",
                                border: `1px solid ${active ? color : "transparent"}`,
                                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                              }}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                              {PAYMENT_METHOD_LABELS[option]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/*
                      The status badge is read from the two amounts rather than picked.
                      It used to be a third selector the user had to keep in step by
                      hand, which is how a task came to read "৳13,500 · UNPAID" long
                      after the money had arrived.
                    */}
                    <div id="payment-summary" className="well p-4" aria-live="polite">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-meta">Due</span>
                        {due != null ? (
                          <Money
                            minor={due}
                            currency={paymentCurrency}
                            size="lg"
                            tone={due > 0 ? "negative" : "positive"}
                            compact
                          />
                        ) : (
                          <span className="text-sm text-ink-secondary">No total set</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-2.5 pt-2.5 border-t border-line">
                        <span className="text-meta">Status</span>
                        <span
                          className="pill"
                          style={{
                            background: `color-mix(in srgb, ${PAYMENT_STATUS_COLORS[derivedStatus]} 14%, transparent)`,
                            color: PAYMENT_STATUS_TEXT_COLORS[derivedStatus],
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: PAYMENT_STATUS_COLORS[derivedStatus] }}
                          />
                          {PAYMENT_STATUS_LABELS[derivedStatus]}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 5. Attachments ─────────────────────────────────── */}
                {wizard.current.id === "attachments" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-eyebrow">Images {images.length}/{MAX_IMAGES}</span>
                      {images.length < MAX_IMAGES && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingCount > 0}
                          className="text-xs font-semibold flex items-center gap-1"
                          style={{ color: "var(--accent)" }}
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          Upload
                        </button>
                      )}
                    </div>

                    {images.length === 0 && uploadingCount === 0 ? (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Upload images"
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        className="rounded-well border-2 border-dashed flex flex-col items-center justify-center py-14 gap-3 cursor-pointer select-none transition-all duration-normal ease-expo"
                        style={{
                          borderColor: dragging ? "var(--accent)" : "var(--border-hover)",
                          background: dragging ? "var(--accent-soft)" : "transparent",
                          transform: dragging ? "scale(1.01)" : "none",
                        }}
                      >
                        <span
                          className={`w-14 h-14 rounded-well flex items-center justify-center ${dragging ? "" : "animate-float"}`}
                          style={{
                            background: dragging ? "var(--accent-dim)" : "var(--bg-sunken)",
                            color: dragging ? "var(--accent)" : "var(--text-muted)",
                          }}
                        >
                          <ImageIcon className="w-7 h-7" />
                        </span>
                        <span className="text-center px-4">
                          <span className="block text-sm font-semibold text-ink">
                            {dragging ? "Drop to upload" : "Drag & drop images"}
                          </span>
                          <span className="block text-xs mt-0.5 text-ink-muted">
                            or click to browse · PNG, JPG, WebP, GIF · max 5 MB
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div
                        className="well p-2"
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        style={{ borderColor: dragging ? "var(--accent)" : "var(--border)" }}
                      >
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 animate-stagger">
                          {images.map((url) => {
                            const isFeature = featureImage === url;
                            return (
                              <div key={url} className="relative group/img rounded-control overflow-hidden aspect-square">
                                <Image src={url} alt="" fill sizes="120px" className="object-cover" />

                                {isFeature && (
                                  <span
                                    className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                                  >
                                    Cover
                                  </span>
                                )}

                                <div
                                  className="absolute inset-0 flex flex-col items-end justify-between p-1.5 opacity-0 group-hover/img:opacity-100 focus-within:opacity-100 transition-opacity"
                                  style={{ background: "rgba(6,8,20,0.62)" }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => removeImage(url)}
                                    className="w-6 h-6 rounded-full flex items-center justify-center"
                                    style={{ background: "var(--red)", color: "var(--on-red)" }}
                                    aria-label="Remove image"
                                  >
                                    <CloseIcon className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setFeatureImage(isFeature ? "" : url)}
                                    className="w-full text-center text-[11px] font-bold py-1 rounded-md"
                                    style={{
                                      // The "unset" state is a translucent wash over the
                                      // dark scrim, so white reads there; the accent fill
                                      // needs the token instead.
                                      background: isFeature ? "rgba(255,255,255,0.22)" : "var(--accent)",
                                      color: isFeature ? "#fff" : "var(--on-accent)",
                                    }}
                                  >
                                    {isFeature ? "Unset cover" : "Set cover"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                          {Array.from({ length: uploadingCount }).map((_, i) => (
                            <div
                              key={`uploading-${i}`}
                              className="aspect-square rounded-control flex items-center justify-center"
                              style={{ background: "var(--bg-card)", color: "var(--accent)" }}
                            >
                              <SpinnerIcon className="w-5 h-5" />
                            </div>
                          ))}

                          {images.length + uploadingCount < MAX_IMAGES && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingCount > 0}
                              className="aspect-square rounded-control border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors duration-fast hover:border-accent hover:text-accent"
                              style={{ borderColor: "var(--border-hover)", color: "var(--text-muted)" }}
                              aria-label="Add more images"
                            >
                              <PlusIcon className="w-4 h-4" />
                              <span className="text-xs">Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/*
                      Always rendered: a task with no upload still gets a cover, and
                      leaving that unsaid made the default look like a bug.
                    */}
                    <p className="text-xs leading-relaxed text-ink-muted">
                      {featureImage
                        ? "This cover is shown on the task card."
                        : images.length > 0
                          ? "Hover an image and choose “Set cover” to use it on the task card. Without one, the default cover is shown."
                          : "No image attached — the task card will use the default cover."}
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      multiple
                      className="hidden"
                      onChange={handleFileInput}
                    />
                  </div>
                )}

                {/* ── 6. Review ──────────────────────────────────────── */}
                {wizard.current.id === "review" && (
                  <ReviewList
                    onEdit={wizard.goTo}
                    items={[
                      { key: "title", label: "Title", value: title.trim(), stepIndex: 0 },
                      {
                        key: "description",
                        label: "Description",
                        value: description.trim(),
                        empty: !description.trim(),
                        stepIndex: 0,
                      },
                      {
                        key: "services",
                        label: "Services",
                        value:
                          progress.total > 0
                            ? `${formatServices(services)} · ${progress.done}/${progress.total} done`
                            : "",
                        empty: progress.total === 0,
                        stepIndex: 1,
                      },
                      /* One row per sub-task, so the review screen shows what
                         was actually captured and not just which boxes were
                         ticked — that is the half most likely to be wrong, and
                         a password typed into the wrong service is invisible
                         from the chip list alone. Values are masked here; the
                         reveal lives on the field itself. */
                      ...subtasks.map((subtask) => {
                        const described = describeSubtaskFields(subtask);
                        return {
                          key: `subtask-${subtask.service}`,
                          label: `↳ ${SERVICE_LABELS[subtask.service]}`,
                          value: described
                            .map((field) => `${field.label}: ${field.value}`)
                            .join(" · "),
                          empty: described.length === 0,
                          stepIndex: 1,
                        };
                      }),
                      {
                        key: "status",
                        label: "Status",
                        value: (
                          <span style={{ color: STATUS_TEXT_COLORS[status] }}>
                            {STATUS_LABELS[status]}
                          </span>
                        ),
                        stepIndex: 2,
                      },
                      {
                        key: "priority",
                        label: "Priority",
                        value: PRIORITY_LABELS[priority],
                        empty: priority === "none",
                        stepIndex: 2,
                      },
                      {
                        key: "due",
                        label: "Due date",
                        value: dueDate ? formatDueLabel(dueDate) : "",
                        empty: !dueDate,
                        stepIndex: 2,
                      },
                      {
                        key: "total",
                        label: "Total cost",
                        value:
                          totalMinor != null ? (
                            <Money minor={totalMinor} currency={paymentCurrency} size="sm" tone="neutral" />
                          ) : (
                            ""
                          ),
                        empty: totalMinor == null,
                        stepIndex: 3,
                      },
                      {
                        key: "due-amount",
                        label: "Still due",
                        value:
                          due != null ? (
                            <Money
                              minor={due}
                              currency={paymentCurrency}
                              size="sm"
                              tone={due > 0 ? "negative" : "positive"}
                            />
                          ) : (
                            ""
                          ),
                        empty: due == null,
                        stepIndex: 3,
                      },
                      {
                        key: "images",
                        label: "Images",
                        value: `${images.length} attached${featureImage ? " · cover set" : ""}`,
                        empty: images.length === 0,
                        stepIndex: 4,
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
                submitLabel={isEdit ? "Save changes" : "Create task"}
                submitIcon={<CheckIcon className="w-4 h-4" />}
                busy={busy}
                disabled={uploadingCount > 0}
                onCancel={() => router.push("/tasks")}
                leading={
                  isEdit ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      disabled={busy}
                      className="btn-danger w-full sm:w-auto"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete task
                    </button>
                  ) : undefined
                }
              />
            </form>
          </div>
        </section>
      </div>

      {confirmDelete && todo && (
        <ConfirmDialog
          title={`Delete “${todo.title}”?`}
          message="This task and its attachments will be permanently removed. This cannot be undone."
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </AppShell>
  );
}
