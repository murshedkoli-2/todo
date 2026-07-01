"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Todo, PaymentStatus, TodoStatus } from "@/lib/types";

interface TaskFormProps {
  todo?: Todo | null;
}

const MAX_IMAGES = 8;

const STATUS_OPTIONS: { value: TodoStatus; label: string; color: string }[] = [
  { value: "todo",        label: "To Do",       color: "#4493f8" },
  { value: "in_progress", label: "In Progress",  color: "#e3b341" },
  { value: "completed",   label: "Completed",    color: "#3fb950" },
];

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string; color: string }[] = [
  { value: "unpaid",  label: "Unpaid",  color: "#f85149" },
  { value: "partial", label: "Partial", color: "#e3b341" },
  { value: "paid",    label: "Paid",    color: "#3fb950" },
];

const CURRENCIES = ["BDT", "USD", "EUR", "GBP", "INR", "AED", "SAR"];

export default function TaskForm({ todo }: TaskFormProps) {
  const router  = useRouter();
  const isEdit  = Boolean(todo);

  const [title,       setTitle]       = useState(todo?.title       ?? "");
  const [description, setDescription] = useState(todo?.description ?? "");
  const [status,      setStatus]      = useState<TodoStatus>(todo?.status ?? "todo");
  const [dueDate,     setDueDate]     = useState(
    todo?.dueDate ? todo.dueDate.slice(0, 10) : ""
  );
  const [images,          setImages]          = useState<string[]>(todo?.images       ?? []);
  const [featureImage,    setFeatureImage]    = useState<string>(todo?.featureImage  ?? "");
  const [paymentAmount,   setPaymentAmount]   = useState<string>(
    todo?.paymentAmount != null ? String(todo.paymentAmount) : ""
  );
  const [paymentCurrency, setPaymentCurrency] = useState<string>(todo?.paymentCurrency ?? "BDT");
  const [paymentStatus,   setPaymentStatus]   = useState<PaymentStatus>(todo?.paymentStatus ?? "unpaid");
  const [saving,          setSaving]          = useState(false);
  const [isDeleting,      setIsDeleting]      = useState(false);
  const [error,           setError]           = useState("");
  const [uploadingCount,  setUploadingCount]  = useState(0);
  const [dragging,        setDragging]        = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Upload helpers ──────────────────────────── */
  const uploadFile = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) { setError("Only image files are allowed."); return null; }
    if (file.size > 5 * 1024 * 1024)    { setError("Each image must be under 5 MB."); return null; }
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) { const d = await res.json(); setError(d.error || "Upload failed"); return null; }
    const d = await res.json();
    return d.url as string;
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr       = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { setError(`Maximum ${MAX_IMAGES} images allowed.`); return; }
    const toUpload  = arr.slice(0, remaining);
    if (arr.length > remaining) setError(`Only ${remaining} more image(s) can be added.`);
    setUploadingCount(n => n + toUpload.length);
    setError("");
    const urls = (await Promise.all(toUpload.map(uploadFile))).filter(Boolean) as string[];
    setImages(prev => {
      const next = [...prev, ...urls];
      if (!featureImage && urls[0]) setFeatureImage(urls[0]);
      return next;
    });
    setUploadingCount(n => n - toUpload.length);
  }, [images.length, featureImage]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) await handleFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files?.length) await handleFiles(e.dataTransfer.files);
  };

  const removeImage = (url: string) => {
    setImages(prev => prev.filter(u => u !== url));
    if (featureImage === url) {
      const next = images.find(u => u !== url);
      setFeatureImage(next ?? "");
    }
  };

  /* ── Submit / Delete ─────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim())      { setError("Title is required"); return; }
    if (uploadingCount > 0) { setError("Please wait for uploads to finish."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        title, description, status, dueDate, images, featureImage,
        paymentAmount:   paymentAmount !== "" ? Number(paymentAmount) : null,
        paymentCurrency,
        paymentStatus,
      };
      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/todos/${todo!._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save");
      }
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!todo) return;
    setIsDeleting(true); setError("");
    try {
      const res = await fetch(`/api/todos/${todo._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  const busy = saving || isDeleting || uploadingCount > 0;

  /* ── Render ──────────────────────────────────── */
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>

      {/* ── Top bar ────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 sm:px-6 h-14"
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Link
          href="/"
          className="btn-ghost w-8 h-8 p-0 rounded-lg flex-shrink-0"
          aria-label="Back to dashboard"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Link href="/" className="transition-colors" style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
            Dashboard
          </Link>
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {isEdit ? "Edit Task" : "New Task"}
          </span>
        </div>

        <div className="flex-1" />

        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="relative w-7 h-7 flex-shrink-0">
            <Image src="/logo.png" alt="TaskFlow Logo" fill className="object-contain drop-shadow" />
          </div>
          <span className="text-sm font-semibold hidden sm:block tracking-tight" style={{ color: "var(--text-primary)" }}>TaskFlow</span>
        </div>
      </header>

      {/* ── Page body ──────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {isEdit ? "Edit Task" : "Create New Task"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {isEdit
              ? "Update the details, images, and status of this task."
              : "Fill in the details below and upload images to create your task."}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in"
            style={{ background: "rgba(248,81,73,0.1)", border: "1px solid rgba(248,81,73,0.3)", color: "var(--red)" }}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ── Left: form fields (3 cols) ─────── */}
            <div className="lg:col-span-3 flex flex-col gap-5">
              <div
                className="rounded-2xl p-6 flex flex-col gap-5"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Task Details
                </h2>

                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="task-title" className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Title <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <input
                    id="task-title"
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    className="input-dark text-base"
                    maxLength={200}
                    required
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="task-description" className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Description
                    <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                  </label>
                  <textarea
                    id="task-description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add context, links, or notes…"
                    className="input-dark resize-none"
                    rows={5}
                    maxLength={2000}
                  />
                </div>
              </div>

              {/* Status & due date */}
              <div
                className="rounded-2xl p-6 flex flex-col gap-5"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Status & Schedule
                </h2>

                {/* Status pills */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTIONS.map(opt => {
                      const active = status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(opt.value)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                          style={{
                            background: active ? `${opt.color}22` : "var(--bg-primary)",
                            border: `1px solid ${active ? opt.color + "66" : "var(--border)"}`,
                            color: active ? opt.color : "var(--text-secondary)",
                          }}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Due date */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="task-due-date" className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Due date
                    <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                  </label>
                  <input
                    id="task-due-date"
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="input-dark"
                    style={{ colorScheme: "dark", maxWidth: "220px" }}
                  />
                </div>
              </div>

              {/* ── Payment ─────────────────────── */}
              <div
                className="rounded-2xl p-6 flex flex-col gap-5"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Payment
                </h2>

                {/* Amount + currency */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="task-payment-amount" className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Amount
                    <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>(optional)</span>
                  </label>
                  <div className="flex gap-2">
                    {/* Currency selector */}
                    <select
                      id="task-payment-currency"
                      value={paymentCurrency}
                      onChange={e => setPaymentCurrency(e.target.value)}
                      className="input-dark"
                      style={{ width: "90px", flexShrink: 0 }}
                    >
                      {CURRENCIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    {/* Amount number input */}
                    <input
                      id="task-payment-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      className="input-dark flex-1"
                    />
                  </div>
                </div>

                {/* Payment status pills */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Payment Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {PAYMENT_STATUS_OPTIONS.map(opt => {
                      const active = paymentStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPaymentStatus(opt.value)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                          style={{
                            background: active ? `${opt.color}22` : "var(--bg-primary)",
                            border: `1px solid ${active ? opt.color + "66" : "var(--border)"}`,
                            color: active ? opt.color : "var(--text-secondary)",
                          }}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: image manager (2 cols) ──── */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div
                className="rounded-2xl p-6 flex flex-col gap-4"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Images <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                      ({images.length}/{MAX_IMAGES})
                    </span>
                  </h2>
                  {images.length < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-medium flex items-center gap-1 transition-colors duration-150"
                      style={{ color: "var(--accent)" }}
                      disabled={uploadingCount > 0}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Upload
                    </button>
                  )}
                </div>

                {/* Drop zone (empty state) */}
                {images.length === 0 && uploadingCount === 0 && (
                  <div
                    className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-10 gap-3 cursor-pointer transition-colors duration-150 select-none"
                    style={{
                      borderColor: dragging ? "var(--accent)" : "var(--border-hover)",
                      background:  dragging ? "var(--accent-dim)" : "transparent",
                    }}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
                    aria-label="Upload images"
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "var(--bg-primary)" }}>
                      <svg className="w-6 h-6" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-center px-4">
                      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        {dragging ? "Drop images here" : "Drag & drop images"}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        or click to browse · PNG, JPG, WebP, GIF · max 5 MB
                      </p>
                    </div>
                  </div>
                )}

                {/* Uploading skeleton tiles */}
                {images.length === 0 && uploadingCount > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: uploadingCount }).map((_, i) => (
                      <div key={i} className="aspect-square rounded-lg flex items-center justify-center"
                        style={{ background: "var(--bg-primary)" }}>
                        <svg className="w-5 h-5 animate-spin" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ))}
                  </div>
                )}

                {/* Thumbnail grid */}
                {images.length > 0 && (
                  <div
                    className="rounded-xl p-2"
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                  >
                    <div className="grid grid-cols-3 gap-2">
                      {images.map(url => {
                        const isFeatured = featureImage === url;
                        return (
                          <div key={url} className="relative group/img rounded-lg overflow-hidden aspect-square">
                            <Image src={url} alt="Task image" fill className="object-cover" sizes="120px" />
                            {/* Featured badge */}
                            {isFeatured && (
                              <div className="absolute top-1 left-1 rounded-full px-1.5 py-0.5 flex items-center gap-0.5 text-xs font-semibold"
                                style={{ background: "rgba(0,0,0,0.75)", color: "#f0c040" }}>
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              </div>
                            )}
                            {/* Hover overlay */}
                            <div className="absolute inset-0 flex flex-col items-end justify-between p-1 opacity-0 group-hover/img:opacity-100 transition-opacity duration-150"
                              style={{ background: "rgba(0,0,0,0.55)" }}>
                              <button type="button" onClick={() => removeImage(url)}
                                className="w-6 h-6 rounded-full flex items-center justify-center"
                                style={{ background: "rgba(248,81,73,0.85)" }}
                                title="Remove image">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              {!isFeatured ? (
                                <button type="button" onClick={() => setFeatureImage(url)}
                                  className="w-full text-center text-xs font-semibold py-0.5 rounded-md transition-colors duration-100"
                                  style={{ background: "rgba(240,192,64,0.85)", color: "#000" }}
                                  title="Set as feature image">
                                  ★ Feature
                                </button>
                              ) : (
                                <button type="button" onClick={() => setFeatureImage("")}
                                  className="w-full text-center text-xs font-semibold py-0.5 rounded-md"
                                  style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
                                  title="Remove as feature">
                                  ✕ Unfeature
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Add more tile */}
                      {images.length < MAX_IMAGES && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingCount > 0}
                          className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors duration-150"
                          style={{ borderColor: "var(--border-hover)" }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-hover)")}
                        >
                          {uploadingCount > 0 ? (
                            <svg className="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {uploadingCount > 0 ? "…" : "Add"}
                          </span>
                        </button>
                      )}
                    </div>

                    {dragging && (
                      <p className="text-center text-xs mt-2 py-1.5 rounded-lg"
                        style={{ color: "var(--accent)", background: "var(--accent-dim)" }}>
                        Drop to add more images
                      </p>
                    )}
                  </div>
                )}

                {/* Feature image hint */}
                {images.length > 0 && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {featureImage
                      ? "★ The starred image will be shown on the task card."
                      : "Hover an image and click ★ Feature to set it as the card cover."}
                  </p>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            </div>
          </div>

          {/* ── Action bar ─────────────────────── */}
          <div
            className="mt-6 flex items-center justify-between rounded-2xl px-6 py-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {/* Delete (edit mode only) */}
            <div>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="btn-danger flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Deleting…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Task
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Cancel + Save */}
            <div className="flex items-center gap-3">
              <Link href="/" className="btn-secondary">Cancel</Link>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary px-6"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving…
                  </>
                ) : isEdit ? "Save changes" : "Create task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
