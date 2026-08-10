"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Todo, TodoStatus, PaymentStatus,
  STATUS_LABELS, STATUS_COLORS, STATUS_TEXT_COLORS,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_TEXT_COLORS,
} from "@/lib/types";
import { api, errorMessage } from "@/lib/apiClient";
import { fromMinor } from "@/lib/money";
import AppShell from "@/components/shell/AppShell";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import {
  PlusIcon, TrashIcon, ImageIcon, AlertIcon, CloseIcon, CheckIcon, SpinnerIcon,
} from "@/components/ui/icons";

interface TaskFormProps {
  todo?: Todo | null;
}

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const STATUS_OPTIONS: TodoStatus[] = ["todo", "in_progress", "completed"];
const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = ["unpaid", "partial", "paid"];
const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "INR", "AED", "SAR"];

export default function TaskForm({ todo }: TaskFormProps) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(todo);

  const [title, setTitle]                   = useState(todo?.title ?? "");
  const [description, setDescription]       = useState(todo?.description ?? "");
  const [status, setStatus]                 = useState<TodoStatus>(todo?.status ?? "todo");
  const [dueDate, setDueDate]               = useState(todo?.dueDate ? todo.dueDate.slice(0, 10) : "");
  const [images, setImages]                 = useState<string[]>(todo?.images ?? []);
  const [featureImage, setFeatureImage]     = useState<string>(todo?.featureImage ?? "");
  // Stored in minor units; the field edits major units, converted on submit.
  const [paymentAmount, setPaymentAmount]   = useState(
    todo?.paymentAmountMinor != null
      ? String(fromMinor(todo.paymentAmountMinor, todo.paymentCurrency))
      : ""
  );
  const [paymentCurrency, setPaymentCurrency] = useState(todo?.paymentCurrency ?? "BDT");
  const [paymentStatus, setPaymentStatus]   = useState<PaymentStatus>(todo?.paymentStatus ?? "unpaid");

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

  const removeImage = (url: string) => {
    const next = images.filter((u) => u !== url);
    setImages(next);
    if (featureImage === url) setFeatureImage(next[0] ?? "");
  };

  /* ── Persistence ─────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("A title is required."); return; }
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
        dueDate: dueDate || null,
        images,
        featureImage: featureImage || null,
        // Sent in major units; the schema converts to integer minor units.
        paymentAmount: paymentAmount !== "" ? paymentAmount : null,
        paymentCurrency,
        paymentStatus,
      };

      await api(isEdit ? `/api/todos/${todo!._id}` : "/api/todos", {
        method: isEdit ? "PATCH" : "POST",
        body: payload,
      });

      toast.success(isEdit ? "Task saved." : "Task created.");
      router.push("/");
      // Without this the server component behind `/` serves its cached render
      // and the new task does not appear until a hard reload.
      router.refresh();
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
      router.push("/");
      router.refresh();
    } catch (caught: unknown) {
      setError(errorMessage(caught));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const busy = saving || deleting || uploadingCount > 0;

  return (
    <AppShell workspace="My Workspace">
      <Breadcrumb items={[{ label: "Tasks", href: "/" }, { label: isEdit ? "Edit task" : "New task" }]} />

      <div className="mb-6">
        <h1 className="text-display">{isEdit ? "Edit task" : "Create a task"}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          {isEdit
            ? "Update the details, schedule, payment, and attachments."
            : "Give it a title, set a schedule, and attach anything relevant."}
        </p>
      </div>

      {error && (
        <div className="alert-error mb-5" role="alert">
          <AlertIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* ── Details ──────────────────────────────────────────────── */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            <section className="panel flex flex-col gap-5">
              <h2 className="text-eyebrow">Task details</h2>

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
                  className="input-dark"
                  maxLength={200}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="task-description" className="field-label">
                  Description <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
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
            </section>

            <section className="panel flex flex-col gap-5">
              <h2 className="text-eyebrow">Status &amp; schedule</h2>

              <div>
                <span className="field-label">Status</span>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => {
                    const active = status === option;
                    const color = STATUS_COLORS[option];
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setStatus(option)}
                        className="flex items-center gap-2 px-4 h-10 rounded-control text-sm font-semibold"
                        style={{
                          background: active
                            ? `color-mix(in srgb, ${color} 12%, transparent)`
                            : "var(--bg-sunken)",
                          border: `1px solid ${active ? color : "transparent"}`,
                          color: active ? STATUS_TEXT_COLORS[option] : "var(--text-secondary)",
                        }}
                        aria-pressed={active}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                        {STATUS_LABELS[option]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="task-due-date" className="field-label">
                  Due date <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input-dark"
                />
              </div>
            </section>

            <section className="panel flex flex-col gap-5">
              <h2 className="text-eyebrow">Payment</h2>

              <div>
                <label htmlFor="task-payment-amount" className="field-label">
                  Amount <span className="font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
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
                <span className="field-label">Payment status</span>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_STATUS_OPTIONS.map((option) => {
                    const active = paymentStatus === option;
                    const color = PAYMENT_STATUS_COLORS[option];
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPaymentStatus(option)}
                        className="flex items-center gap-2 px-4 h-10 rounded-control text-sm font-semibold"
                        style={{
                          background: active
                            ? `color-mix(in srgb, ${color} 12%, transparent)`
                            : "var(--bg-sunken)",
                          border: `1px solid ${active ? color : "transparent"}`,
                          color: active ? PAYMENT_STATUS_TEXT_COLORS[option] : "var(--text-secondary)",
                        }}
                        aria-pressed={active}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                        {PAYMENT_STATUS_LABELS[option]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* ── Attachments ──────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <section className="panel flex flex-col gap-4 lg:sticky lg:top-24">
              <div className="flex items-center justify-between">
                <h2 className="text-eyebrow">Images {images.length}/{MAX_IMAGES}</h2>
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
                  className="rounded-well border-2 border-dashed flex flex-col items-center justify-center py-12 gap-3 cursor-pointer select-none"
                  style={{
                    borderColor: dragging ? "var(--accent)" : "var(--border-hover)",
                    background: dragging ? "var(--accent-soft)" : "transparent",
                  }}
                >
                  <span
                    className="w-12 h-12 rounded-well flex items-center justify-center"
                    style={{ background: "var(--bg-sunken)", color: "var(--text-muted)" }}
                  >
                    <ImageIcon className="w-6 h-6" />
                  </span>
                  <span className="text-center px-4">
                    <span className="block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {dragging ? "Drop to upload" : "Drag & drop images"}
                    </span>
                    <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
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
                  <div className="grid grid-cols-3 gap-2">
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
                            style={{ background: "rgba(8,10,22,0.6)" }}
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
                        className="aspect-square rounded-control border-2 border-dashed flex flex-col items-center justify-center gap-1"
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
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
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
            </section>
          </div>
        </div>

        {/* ── Action bar ────────────────────────────────────────────── */}
        <div className="panel !py-4 mt-5 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          {isEdit ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="btn-danger w-full sm:w-auto"
            >
              <TrashIcon className="w-4 h-4" />
              Delete task
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/" className="btn-outline flex-1 sm:flex-none">Cancel</Link>
            <button type="submit" disabled={busy} className="btn-primary px-6 flex-1 sm:flex-none">
              {saving ? <SpinnerIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create task"}
            </button>
          </div>
        </div>
      </form>

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
